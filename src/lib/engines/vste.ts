import {
  RTT_SAMPLES_DEFAULT,
  RTT_SAMPLES_MAX,
  RTT_SAMPLES_MIN,
  VSTE_COMPLEXITY_N,
  VSTE_FAULT_TIMEOUT_MS,
  VSTE_FUZZ_N,
  VSTE_MEM_CHUNK_BYTES,
  VSTE_MEM_CHUNKS,
  VSTE_REPORT_CAP,
  VSTE_STORAGE_KEY,
} from "./constants.ts";
import { mulberry32, nowMs, percentile } from "./hash.ts";

export type HeapSnap = { allocated: number; peak: number; usedJSHeapSize?: number };

export type FailureTel = {
  index: number;
  input_payload: unknown;
  exception: string;
  error_code: string;
  state_boundary: unknown;
};

export type VectorResult = {
  vector:
    | "monte_carlo_fuzz"
    | "complexity_profiling"
    | "memory_exhaustion"
    | "fault_injection";
  equation: string;
  elapsed_ms: number;
  samples: number;
  failures: number;
  success_rate: number;
  latency_p50: number | null;
  latency_p95: number | null;
  latency_p99: number | null;
  heap_before: HeapSnap;
  heap_after: HeapSnap;
  series?: unknown;
  probes?: unknown;
  network_rtt?: unknown;
  failure_telemetry: FailureTel[];
  extra?: Record<string, unknown>;
};

export class HeapTracker {
  allocated = 0;
  peak = 0;
  track(n: number) {
    this.allocated += n;
    if (this.allocated > this.peak) this.peak = this.allocated;
  }
  release(n: number) {
    this.allocated = Math.max(0, this.allocated - n);
  }
  snap(): HeapSnap {
    const mem = (
      performance as unknown as { memory?: { usedJSHeapSize: number } }
    ).memory;
    return {
      allocated: this.allocated,
      peak: this.peak,
      usedJSHeapSize: mem?.usedJSHeapSize,
    };
  }
}

function heapUsed(): number | undefined {
  return (performance as unknown as { memory?: { usedJSHeapSize: number } })
    .memory?.usedJSHeapSize;
}

type Payload = {
  boundary: number;
  nullish: unknown;
  payload: { x: number; y: number; flag: boolean };
};

export function validatePayload(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const P = input as Payload;
  const safeBoundary = Number.isFinite(P.boundary) ? P.boundary : 0;
  if (safeBoundary < 0 || safeBoundary >= Number.MAX_SAFE_INTEGER) return false;
  if (typeof P.nullish !== "string") return false;
  if (!P.payload || typeof P.payload !== "object") return false;
  if (typeof P.payload.x !== "number" || typeof P.payload.y !== "number") return false;
  return true;
}

function latenciesOf(deltas: number[]) {
  const s = [...deltas].sort((a, b) => a - b);
  return {
    latency_p50: percentile(s, 0.5),
    latency_p95: percentile(s, 0.95),
    latency_p99: percentile(s, 0.99),
  };
}

export async function runMonteCarloFuzz(
  rng: () => number,
  heap: HeapTracker,
): Promise<VectorResult> {
  const t0 = nowMs();
  const heap_before = heap.snap();
  const N = VSTE_FUZZ_N;
  let failures = 0;
  const deltas: number[] = [];
  const tel: FailureTel[] = [];
  for (let i = 0; i < N; i += 1) {
    const s0 = nowMs();
    const u = rng();
    void u;
    let boundary: number;
    if (i % 7 === 0) boundary = Number.MAX_SAFE_INTEGER;
    else if (i % 11 === 0) boundary = -1;
    else if (i % 19 === 0) boundary = Number.NaN;
    else boundary = rng() * 1e6;
    let nullish: unknown;
    if (i % 13 === 0) nullish = null;
    else if (i % 17 === 0) nullish = undefined;
    else nullish = rng().toString(36);
    const P: Payload = {
      boundary,
      nullish,
      payload: {
        x: rng() * 1000 - 500,
        y: Math.sin(rng() * 2 * Math.PI),
        flag: rng() > 0.5,
      },
    };
    const ok = validatePayload(P);
    if (!ok) {
      failures += 1;
      if (tel.length < 30) {
        tel.push({
          index: i,
          input_payload: P,
          exception: "validatePayload_returned_false",
          error_code: "ValidationFailure",
          state_boundary: P.boundary,
        });
      }
    }
    deltas.push(nowMs() - s0);
    if (i % 100 === 99) await Promise.resolve();
  }
  const heap_after = heap.snap();
  return {
    vector: "monte_carlo_fuzz",
    equation: "validatePayload(P); P boundary fuzz over N samples",
    elapsed_ms: nowMs() - t0,
    samples: N,
    failures,
    success_rate: 1 - failures / N,
    ...latenciesOf(deltas),
    heap_before,
    heap_after,
    failure_telemetry: tel,
  };
}

function work(n: number): number {
  let s = 0;
  const inner = Math.min(n, 250);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < inner; j += 1) {
      s += (i * j + i) % 7;
    }
  }
  return s;
}

export async function runComplexity(heap: HeapTracker): Promise<VectorResult> {
  const t0 = nowMs();
  const heap_before = heap.snap();
  const sizes = VSTE_COMPLEXITY_N;
  const series: {
    n: number;
    t_ms: number;
    t_per_rep_ms: number;
    checksum: number;
  }[] = [];
  for (const n of sizes) {
    const reps = n <= 10 ? 5000 : n <= 100 ? 200 : 20;
    const s0 = nowMs();
    let acc = 0;
    for (let r = 0; r < reps; r += 1) acc += work(n);
    const t_ms = nowMs() - s0;
    series.push({
      n,
      t_ms,
      t_per_rep_ms: t_ms / reps,
      checksum: acc % 1000003,
    });
    await Promise.resolve();
  }
  const T_first = series[0]!.t_ms || 1e-9;
  const T_last = series[series.length - 1]!.t_ms;
  const nRatio = sizes[sizes.length - 1]! / sizes[0]!;
  const timeRatio = T_last / T_first;
  let growth: string;
  if (timeRatio > nRatio * nRatio * 0.3) growth = "O(N²)";
  else if (timeRatio > nRatio * 0.5) growth = "O(N)";
  else growth = "O(1)–O(N)";
  return {
    vector: "complexity_profiling",
    equation: "T(N) for N∈{10,100,1000}; empirical growth classification",
    elapsed_ms: nowMs() - t0,
    samples: sizes.length,
    failures: 0,
    success_rate: 1,
    latency_p50: series[0]!.t_ms,
    latency_p95: series[1]!.t_ms,
    latency_p99: series[2]!.t_ms,
    heap_before,
    heap_after: heap.snap(),
    series,
    failure_telemetry: [],
    extra: { growth, timeRatio, nRatio },
  };
}

export async function runMemoryExhaustion(heap: HeapTracker): Promise<VectorResult> {
  const t0 = nowMs();
  const usedBefore = heapUsed();
  const heap_before = heap.snap();
  const held: Uint8Array[] = [];
  let failures = 0;
  const tel: FailureTel[] = [];
  const size = VSTE_MEM_CHUNK_BYTES;
  for (let i = 0; i < VSTE_MEM_CHUNKS; i += 1) {
    try {
      const buf = new Uint8Array(size);
      for (let k = 0; k < 64; k += 1) buf[k * 1024] = (i + k) & 255;
      held.push(buf);
      heap.track(size);
    } catch (err) {
      failures += 1;
      if (tel.length < 30) {
        tel.push({
          index: i,
          input_payload: { chunk: i, size },
          exception: err instanceof Error ? err.message : String(err),
          error_code: "AllocFailure",
          state_boundary: i,
        });
      }
      break;
    }
    if (i % 8 === 7) await Promise.resolve();
  }
  const allocated = held.length * size;
  held.length = 0;
  heap.release(allocated);
  const usedAfter = heapUsed();
  const leak_proxy =
    usedBefore !== undefined && usedAfter !== undefined
      ? usedAfter - usedBefore
      : heap.allocated;
  const success_rate = failures > 0 ? 0.5 : 1;
  return {
    vector: "memory_exhaustion",
    equation: "A=Σ Uint8Array(chunk); track polyfill_arraybuffer_tracker; release",
    elapsed_ms: nowMs() - t0,
    samples: VSTE_MEM_CHUNKS,
    failures,
    success_rate,
    latency_p50: null,
    latency_p95: null,
    latency_p99: null,
    heap_before,
    heap_after: heap.snap(),
    failure_telemetry: tel,
    extra: { leak_proxy, chunks_held: allocated / size },
  };
}

export type ProbeRecord = {
  name: string;
  url: string;
  method: string;
  ok: boolean;
  status: number | null;
  ms: number;
  error: string | null;
};

export function classifyFaultError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/abort|timeout/i.test(msg)) return "timeout";
  if (/Failed to fetch|NetworkError|CORS|Load failed/i.test(msg)) {
    return "network_or_cors";
  }
  return msg;
}

export async function measureNetworkRtt(
  url: string,
  samples = RTT_SAMPLES_DEFAULT,
  timeoutMs = VSTE_FAULT_TIMEOUT_MS,
  fetcher?: (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number | null; ms: number; error: string | null }>,
): Promise<{
  latencies_ms: number[];
  p50: number;
  p95: number;
  p99: number;
  error_count: number;
  errors: string[];
}> {
  const n = Math.min(RTT_SAMPLES_MAX, Math.max(RTT_SAMPLES_MIN, samples));
  const latencies_ms: number[] = [];
  const errors: string[] = [];
  let error_count = 0;
  for (let i = 0; i < n; i += 1) {
    if (fetcher) {
      const r = await fetcher(url, { method: "GET" });
      latencies_ms.push(r.ms);
      if (!r.ok) {
        error_count += 1;
        if (errors.length < 10 && r.error) errors.push(r.error);
      }
      continue;
    }
    const t0 = nowMs();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: ac.signal,
      });
      latencies_ms.push(nowMs() - t0);
      if (!res.ok && res.type !== "opaque") {
        error_count += 1;
        if (errors.length < 10) errors.push(`status ${res.status}`);
      }
    } catch (err) {
      latencies_ms.push(nowMs() - t0);
      error_count += 1;
      if (errors.length < 10) errors.push(classifyFaultError(err));
    } finally {
      clearTimeout(timer);
    }
  }
  const s = [...latencies_ms].sort((a, b) => a - b);
  return {
    latencies_ms,
    p50: percentile(s, 0.5),
    p95: percentile(s, 0.95),
    p99: percentile(s, 0.99),
    error_count,
    errors,
  };
}

export type FaultFetcher = (
  url: string,
  init: RequestInit,
) => Promise<{
  ok: boolean;
  status: number | null;
  ms: number;
  error: string | null;
}>;

export async function runFaultInjection(
  frontend: string,
  backend: string,
  heap: HeapTracker,
  fetchOne: FaultFetcher,
): Promise<VectorResult> {
  const t0 = nowMs();
  const heap_before = heap.snap();
  const frontendRtt = await measureNetworkRtt(frontend, 9, VSTE_FAULT_TIMEOUT_MS, fetchOne);
  const backendRtt = await measureNetworkRtt(backend, 9, VSTE_FAULT_TIMEOUT_MS, fetchOne);
  const healthUrl = backend.replace(/\/$/, "") + "/health";
  const healthRtt = await measureNetworkRtt(healthUrl, 7, VSTE_FAULT_TIMEOUT_MS, fetchOne);
  const named: { name: string; method: string; url: string; body?: string }[] = [
    { name: "frontend_get", method: "GET", url: frontend },
    { name: "backend_get", method: "GET", url: backend },
    { name: "backend_health", method: "GET", url: healthUrl },
    {
      name: "backend_bad_json",
      method: "POST",
      url: backend.replace(/\/$/, "") + "/api/echo",
      body: "{not-json",
    },
  ];
  const probes: ProbeRecord[] = [];
  for (const p of named) {
    const r = await fetchOne(p.url, {
      method: p.method,
      headers: p.body ? { "Content-Type": "application/json" } : undefined,
      body: p.body,
    });
    probes.push({
      name: p.name,
      url: p.url,
      method: p.method,
      ok: r.ok || (r.status ?? 0) > 0,
      status: r.status,
      ms: r.ms,
      error: r.error,
    });
  }
  const success_rate =
    probes.filter((p) => p.ok || (p.status ?? 0) > 0).length / probes.length;
  const failures = probes.filter((p) => !(p.ok || (p.status ?? 0) > 0)).length;
  const allLat = [
    ...frontendRtt.latencies_ms,
    ...backendRtt.latencies_ms,
    ...healthRtt.latencies_ms,
  ].sort((a, b) => a - b);
  return {
    vector: "fault_injection",
    equation: "await fetch(targets); RTT percentiles; fault probes",
    elapsed_ms: nowMs() - t0,
    samples: probes.length,
    failures,
    success_rate,
    latency_p50: percentile(allLat, 0.5),
    latency_p95: percentile(allLat, 0.95),
    latency_p99: percentile(allLat, 0.99),
    heap_before,
    heap_after: heap.snap(),
    probes,
    network_rtt: { frontend: frontendRtt, backend: backendRtt, health: healthRtt },
    failure_telemetry: [],
  };
}

export type VsteCycle = {
  id: string;
  createdAt: string;
  cycle: {
    total_elapsed_ms: number;
    vectors: VectorResult[];
  };
  summary: {
    overall_success: number;
    total_failures: number;
    heap_before: HeapSnap;
    heap_after: HeapSnap;
    heap_delta_bytes: number;
  };
  targets: { frontend: string; backend: string };
};

export async function runVsteCycle(
  frontend: string,
  backend: string,
  fetchOne: FaultFetcher,
  onVector?: (v: VectorResult) => void,
): Promise<VsteCycle> {
  const seed = Date.now() % 1e9;
  const rng = mulberry32(seed);
  const heap = new HeapTracker();
  const heap_before = heap.snap();
  const t0 = nowMs();
  const vectors: VectorResult[] = [];
  const v1 = await runMonteCarloFuzz(rng, heap);
  vectors.push(v1);
  onVector?.(v1);
  const v2 = await runComplexity(heap);
  vectors.push(v2);
  onVector?.(v2);
  const v3 = await runMemoryExhaustion(heap);
  vectors.push(v3);
  onVector?.(v3);
  const v4 = await runFaultInjection(frontend, backend, heap, fetchOne);
  vectors.push(v4);
  onVector?.(v4);
  const heap_after = heap.snap();
  const overall_success =
    vectors.reduce((s, v) => s + v.success_rate, 0) / vectors.length;
  const total_failures = vectors.reduce((s, v) => s + v.failures, 0);
  const cycle: VsteCycle = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    cycle: { total_elapsed_ms: nowMs() - t0, vectors },
    summary: {
      overall_success,
      total_failures,
      heap_before,
      heap_after,
      heap_delta_bytes:
        (heap_after.usedJSHeapSize ?? heap_after.allocated) -
        (heap_before.usedJSHeapSize ?? heap_before.allocated),
    },
    targets: { frontend, backend },
  };
  persistVsteReport(cycle);
  return cycle;
}

export function persistVsteReport(cycle: VsteCycle): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(VSTE_STORAGE_KEY);
    const list: VsteCycle[] = raw ? (JSON.parse(raw) as VsteCycle[]) : [];
    list.unshift(cycle);
    localStorage.setItem(
      VSTE_STORAGE_KEY,
      JSON.stringify(list.slice(0, VSTE_REPORT_CAP)),
    );
  } catch {
    /* quota */
  }
}

export function loadVsteReports(): VsteCycle[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(VSTE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VsteCycle[]) : [];
  } catch {
    return [];
  }
}
