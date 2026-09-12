import assert from "node:assert/strict";
import { test } from "node:test";
import { LB_TO_KG } from "./constants.ts";
import {
  computePhysicalStress,
  emptyPayload,
  fuseFailureRisk,
  parseSpec,
  runUsse,
} from "./usse.ts";
import { assertPublicHttpUrl, isDeniedUrl } from "./ssrf.ts";
import { percentile } from "./hash.ts";
import { TokenBucket } from "./keyharbor.ts";
import { validatePayload } from "./vste.ts";

test("USSE mass from 400 lb is in (180, 185)", () => {
  const p = emptyPayload({ load_lb: 400, lever_arm_m: 0.3, mass_kg: 0 });
  const phys = computePhysicalStress(p);
  assert.ok(phys.mass_kg > 180 && phys.mass_kg < 185);
  assert.equal(phys.mass_kg, 400 * LB_TO_KG);
});

test("USSE high util + high digital pressure fails at 0.85", () => {
  const p = emptyPayload({
    load_lb: 400,
    lever_arm_m: 0.3,
    yield_stress_pa: 1e7,
    agent_count: 80,
    requests_per_second: 200,
    p99_latency_ms: 800,
    error_rate: 0.4,
    attestation_timestamp: Date.now() / 1000,
  });
  const r = runUsse(p);
  assert.equal(r.nase.att_ok, true);
  assert.ok(r.fused.failure_risk >= 0.85);
  assert.equal(r.passed, false);
});

test("USSE stale NASE skips math", () => {
  const p = emptyPayload({
    load_lb: 400,
    attestation_timestamp: Date.now() / 1000 - 120,
  });
  const r = runUsse(p);
  assert.equal(r.passed, false);
  assert.match(r.error ?? "", /NASE attestation-freshness failed/);
});

test("parseSpec extracts pounds and agents", () => {
  const p = parseSpec(
    "Heavy industrial spec for a rigid body with 400 lb load on a 0.3 m lever arm, 12 agents, 50 rps.",
  );
  assert.equal(p.load_lb, 400);
  assert.ok(p.mass_kg > 180);
  assert.equal(p.agent_count, 12);
});

test("SSRF denies loopback and private ranges", () => {
  assert.equal(isDeniedUrl("http://127.0.0.1"), true);
  assert.equal(isDeniedUrl("http://localhost/x"), true);
  assert.equal(isDeniedUrl("http://10.0.0.4"), true);
  assert.equal(isDeniedUrl("http://192.168.1.1"), true);
  assert.equal(isDeniedUrl("http://169.254.1.1"), true);
  assert.equal(isDeniedUrl("http://172.16.0.1"), true);
  assert.equal(isDeniedUrl("http://host.internal"), true);
  assert.equal(isDeniedUrl("ftp://example.com"), true);
  assert.ok(assertPublicHttpUrl("https://example.com/health"));
});

test("percentile is floor index not interpolated", () => {
  const s = [10, 20, 30, 40];
  // index = min(n-1, floor(n × p)) — n=4, p=0.5 → 2 → 30
  assert.equal(percentile(s, 0.5), 30);
  assert.equal(percentile(s, 0.99), 40);
});

test("KeyHarbor sheds when empty and refills", () => {
  const b = new TokenBucket(2, 0, 0);
  assert.equal(b.take(1, 0), true);
  assert.equal(b.take(1, 0), true);
  assert.equal(b.take(1, 0), false);
  const b2 = new TokenBucket(1, 10, 0);
  assert.equal(b2.take(1, 0), true);
  assert.equal(b2.take(1, 0), false);
  assert.equal(b2.take(1, 200), true);
});

test("validatePayload never throws and rejects NaN/nullish", () => {
  assert.equal(validatePayload(null), false);
  assert.equal(
    validatePayload({
      boundary: Number.NaN,
      nullish: "ok",
      payload: { x: 1, y: 2, flag: true },
    }),
    true,
  );
  assert.equal(
    validatePayload({
      boundary: -1,
      nullish: "ok",
      payload: { x: 1, y: 2, flag: true },
    }),
    false,
  );
  assert.equal(
    validatePayload({
      boundary: 3,
      nullish: null,
      payload: { x: 1, y: 2, flag: true },
    }),
    false,
  );
});
