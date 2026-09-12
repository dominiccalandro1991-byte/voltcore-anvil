import {
  LB_TO_KG,
  LIVE_DURATION_MAX_S,
  LIVE_REQUESTS_MAX,
  LIVE_VU_MAX,
  type RunMode,
} from "./engines/constants.ts";
import { emptyPayload, parseSpec, looksLikeSpec, type UssePayload } from "./engines/usse.ts";
import { runVsteCycle, runMonteCarloFuzz, runComplexity, runMemoryExhaustion, type VectorResult, HeapTracker } from "./engines/vste.ts";
import { mulberry32 } from "./engines/hash.ts";
import { SampleAgg, type Tick } from "./engines/probe.ts";
import { executeUsse, createRun, finishRun, abortRun, appendTick, appendVector } from "./server/runs.ts";
import { liveProbe, faultProbe, probeUrls } from "./server/probe.ts";
import { recordRun } from "./engines/meter.ts";
import type { Json } from "./types.ts";

export type RunConfig = {
  mode: RunMode;
  authorized: boolean;
  frontend: string;
  backend: string;
  specText: string;
  loadLb: number;
  leverM: number;
  agents: number;
  rps: number;
  p99: number;
  errorRate: number;
  yieldPa: number;
  vu: number;
  duration: number;
  ramp: number;
  think: number;
  maxReq: number;
  khC: number;
  khR: number;
};

export type RunHooks = {
  onNote: (s: string) => void;
  onTick: (t: Tick) => void;
  onVector: (v: VectorResult) => void;
  onUsse: (r: Awaited<ReturnType<typeof executeUsse>>) => void;
  shouldAbort: () => boolean;
};

function payloadFrom(cfg: RunConfig): UssePayload {
  const base =
    cfg.specText && looksLikeSpec(cfg.specText)
      ? parseSpec(cfg.specText)
      : emptyPayload();
  return emptyPayload({
    ...base,
    load_lb: cfg.loadLb,
    lever_arm_m: cfg.leverM,
    mass_kg: cfg.loadLb * LB_TO_KG,
    agent_count: cfg.agents,
    requests_per_second: cfg.rps,
    p99_latency_ms: cfg.p99,
    error_rate: cfg.errorRate,
    yield_stress_pa: cfg.yieldPa,
    mode:
      cfg.mode === "physical" || cfg.mode === "digital" || cfg.mode === "unified"
        ? cfg.mode
        : "unified",
    attestation_timestamp: Date.now() / 1000,
  });
}

export async function executeCampaign(cfg: RunConfig, hooks: RunHooks) {
  if (!cfg.authorized) throw new Error("ownership attestation required");
  if (cfg.mode === "physical" || cfg.mode === "digital" || cfg.mode === "unified") {
    hooks.onNote("USSE closed-form compute…");
    const res = await executeUsse({
      data: { payload: payloadFrom(cfg), authorized: true },
    });
    recordRun("usse-stress");
    hooks.onUsse(res);
    hooks.onNote(res.report.passed ? "USSE passed" : "USSE failed");
    return res.run.id;
  }

  if (cfg.mode === "virtual" || cfg.mode === "hybrid") {
    const run = await createRun({
      data: {
        mode: cfg.mode,
        engine: cfg.mode === "hybrid" ? "hybrid" : "vste",
        authorized: true,
        target_frontend: cfg.frontend,
        target_backend: cfg.backend,
      },
    });
    hooks.onNote("VSTE cycle — four vectors in series");
    const fetchOne = async (url: string, init: RequestInit) => {
      const r = await faultProbe({
        data: {
          url,
          method: String(init.method ?? "GET"),
          body: typeof init.body === "string" ? init.body : undefined,
        },
      });
      return r;
    };
    if (cfg.mode === "virtual") {
      const cycle = await runVsteCycle(cfg.frontend, cfg.backend, fetchOne, (v) => {
        hooks.onVector(v);
        void appendVector({
          data: {
            run_id: run.id,
            vector: v.vector,
            equation: v.equation,
            elapsed_ms: v.elapsed_ms,
            samples: v.samples,
            failures: v.failures,
            success_rate: v.success_rate,
            latency_p50: v.latency_p50,
            latency_p95: v.latency_p95,
            latency_p99: v.latency_p99,
            heap_before: JSON.parse(JSON.stringify(v.heap_before)) as Json,
            heap_after: JSON.parse(JSON.stringify(v.heap_after)) as Json,
            series: (v.series ?? null) as Json,
            probes: (v.probes ?? null) as Json,
            network_rtt: (v.network_rtt ?? null) as Json,
            failure_telemetry: JSON.parse(JSON.stringify(v.failure_telemetry)) as Json,
            extra: (v.extra ?? null) as Json,
          },
        });
      });
      recordRun("vste");
      await finishRun({
        data: {
          id: run.id,
          status: cycle.summary.overall_success >= 0.5 ? "passed" : "failed",
          overall_success: cycle.summary.overall_success,
          errors: cycle.summary.total_failures,
          summary: { vste: cycle.summary, targets: cycle.targets } as Json,
        },
      });
      hooks.onNote(
        `VSTE complete — success ${cycle.summary.overall_success.toFixed(3)}`,
      );
      return run.id;
    }

    // hybrid: vectors 1–3 in process + live subsample ≤9
    const rng = mulberry32(Date.now() % 1e9);
    const heap = new HeapTracker();
    const v1 = await runMonteCarloFuzz(rng, heap);
    hooks.onVector(v1);
    const v2 = await runComplexity(heap);
    hooks.onVector(v2);
    const v3 = await runMemoryExhaustion(heap);
    hooks.onVector(v3);
    for (const v of [v1, v2, v3]) {
      await appendVector({
        data: {
          run_id: run.id,
          vector: v.vector,
          equation: v.equation,
          elapsed_ms: v.elapsed_ms,
          samples: v.samples,
          failures: v.failures,
          success_rate: v.success_rate,
          latency_p50: v.latency_p50,
          latency_p95: v.latency_p95,
          latency_p99: v.latency_p99,
          heap_before: JSON.parse(JSON.stringify(v.heap_before)) as Json,
          heap_after: JSON.parse(JSON.stringify(v.heap_after)) as Json,
          series: (v.series ?? null) as Json,
          failure_telemetry: JSON.parse(JSON.stringify(v.failure_telemetry)) as Json,
          extra: (v.extra ?? null) as Json,
        },
      });
    }
    const urls = [cfg.frontend, cfg.backend].filter(Boolean).slice(0, 8);
    const batch = await probeUrls({ data: { urls } });
    recordRun("hybrid");
    const overall =
      ([v1, v2, v3].reduce((s, v) => s + v.success_rate, 0) / 3 +
        (batch.n ? batch.ok / batch.n : 1)) /
      2;
    await finishRun({
      data: {
        id: run.id,
        status: overall >= 0.5 ? "passed" : "failed",
        overall_success: overall,
        summary: { hybrid: { probes: batch.results, overall } } as Json,
      },
    });
    hooks.onNote(`Hybrid complete — ${batch.ok}/${batch.n} UP`);
    return run.id;
  }

  // live
  const vu = Math.min(LIVE_VU_MAX, Math.max(1, Math.round(cfg.vu)));
  const duration = Math.min(LIVE_DURATION_MAX_S, Math.max(1, cfg.duration));
  const maxReq = Math.min(LIVE_REQUESTS_MAX, Math.max(1, cfg.maxReq));
  const run = await createRun({
    data: {
      mode: "live",
      engine: "probe-live",
      authorized: true,
      target_frontend: cfg.frontend,
      vu_count: vu,
      duration_s: duration,
      ramp_s: cfg.ramp,
      think_ms: cfg.think,
      max_requests: maxReq,
    },
  });
  recordRun("probe-live");
  hooks.onNote(`Live load ${vu} VU / ${duration}s / cap ${maxReq}`);
  const agg = new SampleAgg();
  const t0 = Date.now();
  let inflight = 0;
  let global = 0;
  let aborted = false;
  const tEnd = t0 + duration * 1000;

  const tickOnce = () => {
    const t = agg.tick(Date.now() - t0, inflight);
    hooks.onTick(t);
    void appendTick({
      data: {
        run_id: run.id,
        t_ms: t.t_ms,
        inflight: t.inflight,
        rps: t.rps,
        error_rate: t.error_rate,
        p50: t.p50,
        p95: t.p95,
        p99: t.p99,
        ok: t.ok,
        err: t.err,
        shed: t.shed,
        status_2xx: t.status_2xx,
        status_3xx: t.status_3xx,
        status_4xx: t.status_4xx,
        status_5xx: t.status_5xx,
        status_0: t.status_0,
      },
    });
  };

  const ticker = setInterval(tickOnce, 250);

  const vuLoop = async (id: number) => {
    const delay =
      vu <= 1 ? 0 : (cfg.ramp * 1000 * id) / Math.max(1, vu - 1);
    await sleep(delay);
    while (Date.now() < tEnd && global < maxReq && !hooks.shouldAbort() && !aborted) {
      if (hooks.shouldAbort()) break;
      inflight += 1;
      global += 1;
      const r = await liveProbe({
        data: {
          url: cfg.frontend,
          method: "GET",
          run_id: run.id,
          capacity: cfg.khC,
          refill: cfg.khR,
        },
      });
      inflight -= 1;
      agg.push(r, r.shed);
      if (cfg.think > 0) await sleep(cfg.think);
    }
  };

  try {
    await Promise.all(Array.from({ length: vu }, (_, i) => vuLoop(i)));
  } finally {
    clearInterval(ticker);
    tickOnce();
  }
  aborted = hooks.shouldAbort();
  if (aborted) {
    await abortRun({ data: run.id });
    hooks.onNote("Aborted");
    return run.id;
  }
  const last = agg.tick(Date.now() - t0, 0);
  await finishRun({
    data: {
      id: run.id,
      status: last.error_rate < 0.15 ? "passed" : "failed",
      requests: last.ok + last.err + last.shed,
      errors: last.err,
      shed_429: last.shed,
      rps_peak: last.rps,
      error_rate: last.error_rate,
      p50_ms: last.p50,
      p95_ms: last.p95,
      p99_ms: last.p99,
      overall_success: 1 - last.error_rate,
      summary: { histogram: agg.histogram, live: last } as Json,
    },
  });
  hooks.onNote(
    `Live complete — ${last.ok} ok / ${last.err} err / ${last.shed} shed`,
  );
  return run.id;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
