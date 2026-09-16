import { mulberry32 } from "./hash.ts";
import type { CompileReport, LatencyHit, StrikerFinding, StrikerState, StripReport } from "./types.ts";

export const STRIKER_TICKS = 48;
const SAMPLE_CAP = 96;
const WORKERS = 8;
const QUEUE_CAP = 32;

export function emptyStriker(): StrikerState {
  return {
    tick: 0,
    workers: WORKERS,
    inflight: 0,
    completed: 0,
    dropped: 0,
    samples: [],
    p50: 0,
    p95: 0,
    p99: 0,
    utilization: 0,
    findings: [],
    done: false,
  };
}

interface Heap {
  n: number;
  a: number[];
}
function heapPush(h: Heap, v: number) {
  let i = h.n++;
  h.a[i] = v;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h.a[p] <= h.a[i]) break;
    const t = h.a[p];
    h.a[p] = h.a[i];
    h.a[i] = t;
    i = p;
  }
}
function heapPop(h: Heap): number {
  const out = h.a[0];
  const last = h.a[--h.n];
  if (h.n === 0) return out;
  h.a[0] = last;
  let i = 0;
  for (;;) {
    const l = i * 2 + 1;
    const r = l + 1;
    let s = i;
    if (l < h.n && h.a[l] < h.a[s]) s = l;
    if (r < h.n && h.a[r] < h.a[s]) s = r;
    if (s === i) break;
    const t = h.a[i];
    h.a[i] = h.a[s];
    h.a[s] = t;
    i = s;
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)));
  return sorted[i];
}

function pushFinding(state: StrikerState, finding: StrikerFinding) {
  if (state.findings.some((f) => f.kind === finding.kind && f.detail === finding.detail)) return;
  state.findings = state.findings.concat(finding);
}

/** Discrete-event concurrency step. Event heap O(log k), k ≤ workers. */
export function stepStriker(
  state: StrikerState,
  strip: StripReport,
  compile: CompileReport,
  seed: number,
): StrikerState {
  if (state.done) return state;
  const rng = mulberry32(seed ^ (0x9e3779b9 + state.tick * 1103515245));
  const racey = strip.anomalies.some((a) => a.kind === "race_shared" || a.kind === "missing_await");
  const cyclic = compile.cycles.length > 0;
  const baseMs = 8 + compile.complexity * 0.35 + (racey ? 22 : 0) + (cyclic ? 14 : 0);
  const arrival = 2 + (racey ? 3 : 0) + (compile.routes.filter((r) => r.kind === "api" || r.kind === "ssr").length > 3 ? 2 : 0);

  const next: StrikerState = {
    ...state,
    tick: state.tick + 1,
    samples: state.samples.slice(),
    findings: state.findings.slice(),
  };

  const due: Heap = { n: 0, a: [] };
  for (let w = 0; w < next.inflight; w++) heapPush(due, 1 + Math.floor(rng() * 3));

  let inflight = next.inflight;
  const hits: LatencyHit[] = [];
  for (let i = 0; i < arrival; i++) {
    if (inflight >= QUEUE_CAP) {
      next.dropped += 1;
      continue;
    }
    inflight += 1;
    const jitter = rng();
    const tail = racey && jitter > 0.82 ? 4 + rng() * 6 : 1;
    const ms = Math.max(1, Math.round(baseMs * tail * (0.7 + rng() * 0.9)));
    const worker = Math.floor(rng() * WORKERS);
    const ok = !(racey && jitter > 0.92);
    hits.push({ t: next.tick, ms, worker, ok });
    heapPush(due, ms);
  }

  const finishN = Math.min(inflight, 1 + Math.floor(rng() * Math.min(WORKERS, inflight)));
  for (let i = 0; i < finishN && due.n; i++) {
    heapPop(due);
    inflight -= 1;
    next.completed += 1;
  }
  next.inflight = Math.max(0, inflight);
  next.samples.push(...hits);
  if (next.samples.length > SAMPLE_CAP) next.samples.splice(0, next.samples.length - SAMPLE_CAP);

  const lat = next.samples.map((s) => s.ms).sort((a, b) => a - b);
  next.p50 = percentile(lat, 50);
  next.p95 = percentile(lat, 95);
  next.p99 = percentile(lat, 99);
  next.utilization = Math.min(1, next.inflight / WORKERS);

  if (next.utilization > 0.85) {
    pushFinding(next, {
      kind: "saturation",
      detail: `Worker utilization ${(next.utilization * 100).toFixed(0)}%`,
      severity: "warn",
    });
  }
  if (next.p99 > 120) {
    pushFinding(next, { kind: "tail_latency", detail: `p99 ${next.p99} ms exceeds 120 ms bound`, severity: "error" });
  }
  if (racey) {
    pushFinding(next, {
      kind: "race",
      detail: "Shared mutable cell under concurrent writers",
      severity: "error",
    });
  }
  if (cyclic) {
    pushFinding(next, { kind: "deadlock", detail: "Import cycle can stall wait-for graph", severity: "warn" });
  }
  if (next.dropped > 4) {
    pushFinding(next, { kind: "drop", detail: `${next.dropped} requests dropped at queue cap`, severity: "error" });
  }
  if (next.tick >= STRIKER_TICKS) next.done = true;
  return next;
}
