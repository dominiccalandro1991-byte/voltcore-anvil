import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { probeOne, type ProbeResult } from "@/lib/engines/probe";
import { TokenBucket } from "@/lib/engines/keyharbor";
import {
  KEYHARBOR_DEFAULT_C,
  KEYHARBOR_DEFAULT_R,
  LIVE_REQUESTS_MAX,
  LIVE_VU_MAX,
  PROBE_TIMEOUT_MS,
  PROBE_URL_CAP,
  VSTE_FAULT_TIMEOUT_MS,
  NANO_SANDBOX_API,
} from "@/lib/engines/constants";
import { SsrfError, assertPublicHttpUrl } from "@/lib/engines/ssrf";
import type { Json } from "@/lib/types";
import { isHealDenied } from "@/lib/engines/isolate";

const buckets = new Map<string, TokenBucket>();
const runCounts = new Map<string, number>();

function bucketFor(userId: string, c: number, r: number): TokenBucket {
  const key = `${userId}:${c}:${r}`;
  let b = buckets.get(key);
  if (!b) {
    b = new TokenBucket(c, r);
    buckets.set(key, b);
  }
  return b;
}

export const probeUrls = createServerFn({ method: "POST" })
  .validator((input: { urls: string[] }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const urls = data.urls.slice(0, PROBE_URL_CAP);
    const results: ProbeResult[] = await Promise.all(
      urls.map((u) => probeOne(u, { method: "HEAD", timeoutMs: PROBE_TIMEOUT_MS })),
    );
    const ok = results.filter((r) => r.ok).length;
    return { results, ok, n: results.length };
  });

export type LiveProbeInput = {
  url: string;
  method?: "HEAD" | "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  run_id?: string;
  capacity?: number;
  refill?: number;
  timeoutMs?: number;
};

export const liveProbe = createServerFn({ method: "POST" })
  .validator((input: LiveProbeInput) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    try {
      assertPublicHttpUrl(data.url);
    } catch (err) {
      const msg = err instanceof SsrfError ? err.message : "denied";
      return {
        url: data.url,
        ok: false,
        status: null,
        ms: 0,
        bytes: null,
        error: msg,
        shed: false,
      };
    }
    if (data.body && data.body.length > 64 * 1024) {
      return {
        url: data.url,
        ok: false,
        status: null,
        ms: 0,
        bytes: null,
        error: "body exceeds 64 KiB",
        shed: false,
      };
    }
    if (data.run_id) {
      const n = (runCounts.get(data.run_id) ?? 0) + 1;
      runCounts.set(data.run_id, n);
      if (n > LIVE_REQUESTS_MAX) {
        return {
          url: data.url,
          ok: false,
          status: 429,
          ms: 0,
          bytes: null,
          error: "max_requests",
          shed: true,
        };
      }
    }
    const b = bucketFor(
      context.userId,
      data.capacity ?? KEYHARBOR_DEFAULT_C,
      data.refill ?? KEYHARBOR_DEFAULT_R,
    );
    if (!b.take(1)) {
      return {
        url: data.url,
        ok: false,
        status: 429,
        ms: 0,
        bytes: null,
        error: "shed_429",
        shed: true,
        tokens: b.snapshot().tokens,
      };
    }
    const r = await probeOne(data.url, {
      method: data.method ?? "GET",
      timeoutMs: data.timeoutMs ?? PROBE_TIMEOUT_MS,
      body: data.body,
      headers: data.headers,
    });
    return { ...r, shed: false, tokens: b.snapshot().tokens };
  });

export const keyHarborSnap = createServerFn({ method: "GET" })
  .validator((input: { capacity?: number; refill?: number }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const b = bucketFor(
      context.userId,
      data.capacity ?? KEYHARBOR_DEFAULT_C,
      data.refill ?? KEYHARBOR_DEFAULT_R,
    );
    return b.snapshot();
  });

export const faultProbe = createServerFn({ method: "POST" })
  .validator((input: { url: string; method?: string; body?: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    try {
      assertPublicHttpUrl(data.url);
    } catch (err) {
      return {
        ok: false,
        status: null as number | null,
        ms: 0,
        error: err instanceof Error ? err.message : "denied",
      };
    }
    const r = await probeOne(data.url, {
      method: (data.method as "GET" | "POST" | "HEAD") ?? "GET",
      timeoutMs: VSTE_FAULT_TIMEOUT_MS,
      body: data.body,
      headers: data.body ? { "Content-Type": "application/json" } : undefined,
    });
    return { ok: r.ok, status: r.status, ms: r.ms, error: r.error };
  });

export const sandboxJob = createServerFn({ method: "POST" })
  .validator((input: { validator_id: string; payload: unknown; seed?: number }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    if (
      isHealDenied(data.validator_id) ||
      isHealDenied(JSON.stringify(data.payload ?? {}))
    ) {
      return {
        ok: false,
        status: 403,
        body: { error: "heal/trunk denied" } satisfies Json,
      };
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(`${NANO_SANDBOX_API}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          validator_id: data.validator_id,
          payload: data.payload,
          seed: data.seed ?? 1,
        }),
        signal: ac.signal,
      });
      const text = await res.text();
      let json: Json = text;
      try {
        json = JSON.parse(text) as Json;
      } catch {
        json = text;
      }
      return { ok: res.ok, status: res.status, body: json };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        body: {
          error: "nano-sandbox-api unreachable",
          detail: err instanceof Error ? err.message : String(err),
        } satisfies Json,
      };
    } finally {
      clearTimeout(timer);
    }
  });

export const liveCaps = {
  vuMax: LIVE_VU_MAX,
  durationMax: 120,
  requestsMax: LIVE_REQUESTS_MAX,
};
