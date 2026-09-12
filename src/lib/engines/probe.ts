import { PROBE_TIMEOUT_MS, USER_AGENT } from "./constants.ts";
import { emptyHistogram, histogramBin, percentile } from "./hash.ts";
import { assertPublicHttpUrl } from "./ssrf.ts";

export type ProbeResult = {
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  bytes: number | null;
  error: string | null;
};

export async function probeOne(
  raw: string,
  opts?: { method?: "HEAD" | "GET" | "POST"; timeoutMs?: number; body?: string; headers?: Record<string, string> },
): Promise<ProbeResult> {
  const t0 = Date.now();
  let url: URL;
  try {
    url = assertPublicHttpUrl(raw);
  } catch (err) {
    return {
      url: raw,
      ok: false,
      status: null,
      ms: Date.now() - t0,
      bytes: null,
      error: err instanceof Error ? err.message : "denied",
    };
  }
  const timeoutMs = opts?.timeoutMs ?? PROBE_TIMEOUT_MS;
  const method = opts?.method ?? "HEAD";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    ...(opts?.headers ?? {}),
  };
  try {
    let res = await fetch(url.toString(), {
      method,
      redirect: "follow",
      cache: "no-store",
      signal: ac.signal,
      headers,
      body: method === "POST" ? (opts?.body ?? "") : undefined,
    });
    if ((res.status === 405 || res.status === 501) && method === "HEAD") {
      res = await fetch(url.toString(), {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: ac.signal,
        headers: { "User-Agent": USER_AGENT },
      });
    }
    const cl = res.headers.get("content-length");
    const bytes = cl ? Number(cl) : null;
    return {
      url: url.toString(),
      ok: res.ok || res.type === "opaque",
      status: res.status || null,
      ms: Date.now() - t0,
      bytes: Number.isFinite(bytes) ? bytes : null,
      error: res.ok ? null : `status ${res.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const error = /abort/i.test(msg) ? "timeout" : msg;
    return {
      url: url.toString(),
      ok: false,
      status: null,
      ms: Date.now() - t0,
      bytes: null,
      error,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type Tick = {
  t_ms: number;
  inflight: number;
  rps: number;
  error_rate: number;
  p50: number;
  p95: number;
  p99: number;
  ok: number;
  err: number;
  shed: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  status_0: number;
};

export class SampleAgg {
  latencies: number[] = [];
  ok = 0;
  err = 0;
  shed = 0;
  s2 = 0;
  s3 = 0;
  s4 = 0;
  s5 = 0;
  s0 = 0;
  histogram = emptyHistogram();
  windowStart = Date.now();
  windowOk = 0;

  push(r: ProbeResult, shed = false) {
    this.latencies.push(r.ms);
    this.histogram[histogramBin(r.ms)] += 1;
    if (shed) {
      this.shed += 1;
      this.s0 += 1;
      return;
    }
    const st = r.status ?? 0;
    if (st >= 200 && st < 300) this.s2 += 1;
    else if (st >= 300 && st < 400) this.s3 += 1;
    else if (st >= 400 && st < 500) this.s4 += 1;
    else if (st >= 500) this.s5 += 1;
    else this.s0 += 1;
    if (r.ok) {
      this.ok += 1;
      this.windowOk += 1;
    } else this.err += 1;
  }

  tick(t_ms: number, inflight: number): Tick {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const elapsed = Math.max(0.25, t_ms / 1000);
    const total = this.ok + this.err + this.shed;
    return {
      t_ms,
      inflight,
      rps: total / elapsed,
      error_rate: total === 0 ? 0 : this.err / total,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      ok: this.ok,
      err: this.err,
      shed: this.shed,
      status_2xx: this.s2,
      status_3xx: this.s3,
      status_4xx: this.s4,
      status_5xx: this.s5,
      status_0: this.s0,
    };
  }
}
