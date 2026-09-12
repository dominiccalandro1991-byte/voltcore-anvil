import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { iso } from "@/lib/utils";
import type { RunRow, TickRow, VectorRow, Json } from "@/lib/types";
import { runUsse, emptyPayload, type UssePayload } from "@/lib/engines/usse";
import { exportAttestation } from "@/lib/engines/nase";
import { eng04Anomaly, eng05Aegis, eng23Dojo } from "@/lib/engines/map-b";
import type { RunMode, EngineId, RunStatus } from "@/lib/engines/constants";

function asRun(r: Record<string, unknown>): RunRow {
  const summary: Json =
    typeof r.summary === "string"
      ? (JSON.parse(r.summary) as Json)
      : ((r.summary as Json) ?? {});
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    mode: r.mode as RunMode,
    engine: r.engine as EngineId,
    target_frontend: (r.target_frontend as string) ?? null,
    target_backend: (r.target_backend as string) ?? null,
    authorized: Boolean(r.authorized),
    started_at: iso(r.started_at),
    ended_at: r.ended_at ? iso(r.ended_at) : null,
    status: r.status as RunStatus,
    vu_count: Number(r.vu_count ?? 0),
    duration_s: Number(r.duration_s ?? 0),
    ramp_s: Number(r.ramp_s ?? 0),
    think_ms: Number(r.think_ms ?? 0),
    max_requests: Number(r.max_requests ?? 0),
    requests: Number(r.requests ?? 0),
    errors: Number(r.errors ?? 0),
    shed_429: Number(r.shed_429 ?? 0),
    rps_peak: Number(r.rps_peak ?? 0),
    error_rate: Number(r.error_rate ?? 0),
    p50_ms: r.p50_ms == null ? null : Number(r.p50_ms),
    p95_ms: r.p95_ms == null ? null : Number(r.p95_ms),
    p99_ms: r.p99_ms == null ? null : Number(r.p99_ms),
    overall_success: r.overall_success == null ? null : Number(r.overall_success),
    failure_risk: r.failure_risk == null ? null : Number(r.failure_risk),
    s_attest: (r.s_attest as string) ?? null,
    weighted_sum: r.weighted_sum == null ? null : Number(r.weighted_sum),
    attestation_ok: Boolean(r.attestation_ok),
    summary,
    created_at: iso(r.created_at),
  };
}

export const listRuns = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_runs
      where user_id = ${context.userId}
      order by started_at desc
      limit 40
    `;
    return rows.map(asRun);
  });

export const getRun = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_runs where id = ${id} and user_id = ${context.userId} limit 1
    `;
    const run = rows[0] ? asRun(rows[0]) : null;
    if (!run) return { run: null, ticks: [] as TickRow[], vectors: [] as VectorRow[] };
    const ticks = await sql<Record<string, unknown>>`
      select * from anvil_ticks where run_id = ${id} and user_id = ${context.userId} order by t_ms asc
    `;
    const vectors = await sql<Record<string, unknown>>`
      select * from anvil_vectors where run_id = ${id} and user_id = ${context.userId}
    `;
    return {
      run,
      ticks: ticks.map((t) => ({
        id: String(t.id),
        run_id: String(t.run_id),
        t_ms: Number(t.t_ms),
        inflight: Number(t.inflight),
        rps: Number(t.rps),
        error_rate: Number(t.error_rate),
        p50: t.p50 == null ? null : Number(t.p50),
        p95: t.p95 == null ? null : Number(t.p95),
        p99: t.p99 == null ? null : Number(t.p99),
        ok: Number(t.ok),
        err: Number(t.err),
        shed: Number(t.shed),
        status_2xx: Number(t.status_2xx),
        status_3xx: Number(t.status_3xx),
        status_4xx: Number(t.status_4xx),
        status_5xx: Number(t.status_5xx),
        status_0: Number(t.status_0),
      })),
      vectors: vectors.map((v) => ({
        id: String(v.id),
        run_id: String(v.run_id),
        vector: String(v.vector),
        equation: String(v.equation),
        elapsed_ms: Number(v.elapsed_ms),
        samples: Number(v.samples),
        failures: Number(v.failures),
        success_rate: Number(v.success_rate),
        latency_p50: v.latency_p50 == null ? null : Number(v.latency_p50),
        latency_p95: v.latency_p95 == null ? null : Number(v.latency_p95),
        latency_p99: v.latency_p99 == null ? null : Number(v.latency_p99),
        heap_before: (v.heap_before ?? null) as Json,
        heap_after: (v.heap_after ?? null) as Json,
        series: (v.series ?? null) as Json,
        probes: (v.probes ?? null) as Json,
        network_rtt: (v.network_rtt ?? null) as Json,
        failure_telemetry: (v.failure_telemetry ?? []) as Json,
        extra: (v.extra ?? null) as Json,
      })),
    };
  });

export type CreateRunInput = {
  mode: RunMode;
  engine: EngineId;
  authorized: boolean;
  target_frontend?: string | null;
  target_backend?: string | null;
  vu_count?: number;
  duration_s?: number;
  ramp_s?: number;
  think_ms?: number;
  max_requests?: number;
  summary?: Json;
};

export const createRun = createServerFn({ method: "POST" })
  .validator((input: CreateRunInput) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.authorized) {
      throw new Error("ownership attestation required");
    }
    const sql = await getSql();
    const id = crypto.randomUUID();
    const summary = JSON.stringify(data.summary ?? {});
    await sql`
      insert into anvil_runs (
        id, user_id, mode, engine, target_frontend, target_backend,
        authorized, status, vu_count, duration_s, ramp_s, think_ms, max_requests, summary
      ) values (
        ${id}, ${context.userId}, ${data.mode}, ${data.engine},
        ${data.target_frontend ?? null}, ${data.target_backend ?? null},
        ${true}, ${"running"}, ${data.vu_count ?? 0}, ${data.duration_s ?? 0},
        ${data.ramp_s ?? 0}, ${data.think_ms ?? 0}, ${data.max_requests ?? 0},
        ${summary}::jsonb
      )
    `;
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_runs where id = ${id} and user_id = ${context.userId}
    `;
    return asRun(rows[0]!);
  });

export type FinishRunInput = {
  id: string;
  status: RunStatus;
  requests?: number;
  errors?: number;
  shed_429?: number;
  rps_peak?: number;
  error_rate?: number;
  p50_ms?: number | null;
  p95_ms?: number | null;
  p99_ms?: number | null;
  overall_success?: number | null;
  failure_risk?: number | null;
  s_attest?: string | null;
  weighted_sum?: number | null;
  attestation_ok?: boolean;
  summary?: Json;
};

export const finishRun = createServerFn({ method: "POST" })
  .validator((input: FinishRunInput) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<Record<string, unknown>>`
      select summary from anvil_runs where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!existing[0]) throw new Error("run not found");
    const prev: Record<string, Json> =
      typeof existing[0].summary === "string"
        ? (JSON.parse(existing[0].summary as string) as Record<string, Json>)
        : ((existing[0].summary as Record<string, Json>) ?? {});
    const extra =
      data.summary && typeof data.summary === "object" && !Array.isArray(data.summary)
        ? data.summary
        : {};
    const merged = { ...prev, ...extra };
    const summary = JSON.stringify(merged);
    await sql`
      update anvil_runs set
        status = ${data.status},
        ended_at = now(),
        requests = ${data.requests ?? 0},
        errors = ${data.errors ?? 0},
        shed_429 = ${data.shed_429 ?? 0},
        rps_peak = ${data.rps_peak ?? 0},
        error_rate = ${data.error_rate ?? 0},
        p50_ms = ${data.p50_ms ?? null},
        p95_ms = ${data.p95_ms ?? null},
        p99_ms = ${data.p99_ms ?? null},
        overall_success = ${data.overall_success ?? null},
        failure_risk = ${data.failure_risk ?? null},
        s_attest = ${data.s_attest ?? null},
        weighted_sum = ${data.weighted_sum ?? null},
        attestation_ok = ${data.attestation_ok ?? true},
        summary = ${summary}::jsonb
      where id = ${data.id} and user_id = ${context.userId}
    `;
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_runs where id = ${data.id} and user_id = ${context.userId}
    `;
    return asRun(rows[0]!);
  });

export const abortRun = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`
      update anvil_runs set status = ${"aborted"}, ended_at = now()
      where id = ${id} and user_id = ${context.userId} and status = ${"running"}
    `;
    return { ok: true };
  });

export const appendTick = createServerFn({ method: "POST" })
  .validator((input: Omit<TickRow, "id"> & { run_id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from anvil_runs where id = ${data.run_id} and user_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("run not found");
    const id = crypto.randomUUID();
    await sql`
      insert into anvil_ticks (
        id, run_id, user_id, t_ms, inflight, rps, error_rate, p50, p95, p99,
        ok, err, shed, status_2xx, status_3xx, status_4xx, status_5xx, status_0
      ) values (
        ${id}, ${data.run_id}, ${context.userId}, ${data.t_ms}, ${data.inflight},
        ${data.rps}, ${data.error_rate}, ${data.p50}, ${data.p95}, ${data.p99},
        ${data.ok}, ${data.err}, ${data.shed}, ${data.status_2xx}, ${data.status_3xx},
        ${data.status_4xx}, ${data.status_5xx}, ${data.status_0}
      )
    `;
    return { id };
  });

export const appendVector = createServerFn({ method: "POST" })
  .validator(
    (input: {
      run_id: string;
      vector: string;
      equation: string;
      elapsed_ms: number;
      samples: number;
      failures: number;
      success_rate: number;
      latency_p50?: number | null;
      latency_p95?: number | null;
      latency_p99?: number | null;
      heap_before?: Json;
      heap_after?: Json;
      series?: Json;
      probes?: Json;
      network_rtt?: Json;
      failure_telemetry?: Json;
      extra?: Json;
    }) => input,
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from anvil_runs where id = ${data.run_id} and user_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("run not found");
    const id = crypto.randomUUID();
    await sql`
      insert into anvil_vectors (
        id, run_id, user_id, vector, equation, elapsed_ms, samples, failures, success_rate,
        latency_p50, latency_p95, latency_p99, heap_before, heap_after, series, probes,
        network_rtt, failure_telemetry, extra
      ) values (
        ${id}, ${data.run_id}, ${context.userId}, ${data.vector}, ${data.equation},
        ${data.elapsed_ms}, ${data.samples}, ${data.failures}, ${data.success_rate},
        ${data.latency_p50 ?? null}, ${data.latency_p95 ?? null}, ${data.latency_p99 ?? null},
        ${JSON.stringify(data.heap_before ?? null)}::jsonb,
        ${JSON.stringify(data.heap_after ?? null)}::jsonb,
        ${JSON.stringify(data.series ?? null)}::jsonb,
        ${JSON.stringify(data.probes ?? null)}::jsonb,
        ${JSON.stringify(data.network_rtt ?? null)}::jsonb,
        ${JSON.stringify(data.failure_telemetry ?? [])}::jsonb,
        ${JSON.stringify(data.extra ?? null)}::jsonb
      )
    `;
    return { id };
  });

export const executeUsse = createServerFn({ method: "POST" })
  .validator((input: { payload: Partial<UssePayload>; authorized: boolean }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.authorized) throw new Error("ownership attestation required");
    const payload = emptyPayload({
      ...data.payload,
      attestation_timestamp:
        data.payload.attestation_timestamp && data.payload.attestation_timestamp > 0
          ? data.payload.attestation_timestamp
          : Date.now() / 1000,
    });
    const report = runUsse(payload);
    const att = await exportAttestation();
    const incident = JSON.stringify({
      mode: payload.mode,
      failure_risk: report.fused.failure_risk,
      utilization: report.physical.utilization,
      digital_pressure: report.digital.digital_pressure,
      error: report.error,
    });
    const aegis = eng05Aegis(incident);
    const dojo = eng23Dojo(
      `usse ${payload.mode} risk=${report.fused.failure_risk} util=${report.physical.utilization}`,
    );
    const series = [
      report.physical.utilization,
      report.digital.digital_pressure,
      report.fused.failure_risk,
    ].join(",");
    const anomaly = eng04Anomaly(series);
    const sql = await getSql();
    const id = crypto.randomUUID();
    const summary = JSON.stringify({
      usse: report,
      nase: { att_ok: report.nase.att_ok, att_reason: report.nase.att_reason, delta_seconds: report.nase.delta_seconds },
      incident: {
        winner_playbook: aegis.output.winner_playbook,
        playbook_scores: aegis.output.playbook_scores,
        runbook_hits: dojo.output.runbook_hits,
      },
      anomaly: anomaly.output,
      attestation: { s_attest: att.s_attest, weighted_sum: att.weighted_sum, nonce: att.nonce },
    });
    const status: RunStatus = report.passed ? "passed" : "failed";
    await sql`
      insert into anvil_runs (
        id, user_id, mode, engine, authorized, status, ended_at,
        failure_risk, overall_success, s_attest, weighted_sum, attestation_ok, summary
      ) values (
        ${id}, ${context.userId}, ${payload.mode}, ${"usse-stress"},
        ${true}, ${status}, now(),
        ${report.fused.failure_risk}, ${report.score ?? 0},
        ${att.s_attest}, ${att.weighted_sum}, ${report.nase.att_ok}, ${summary}::jsonb
      )
    `;
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_runs where id = ${id} and user_id = ${context.userId}
    `;
    return { run: asRun(rows[0]!), report, attestation: att };
  });

export const computeAttestation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    return exportAttestation();
  });
