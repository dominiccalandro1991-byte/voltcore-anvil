import assert from "node:assert/strict";
import { test } from "node:test";
import { FIXTURES } from "./fixtures.ts";
import { LANE_CEILING } from "./fleet.ts";
import { createForge, loadBundle, runUntil, serialize } from "./hammer-forge.ts";
import { ingestFiles } from "./ingest.ts";

test("lattice ceiling is 31", () => {
  assert.equal(LANE_CEILING, 31);
});

test("leaky fixture is rejected after dual stress", () => {
  const forge = runUntil(loadBundle(createForge(1), FIXTURES[0].build()), "done");
  assert.equal(forge.phase, "done");
  assert.ok(forge.score);
  assert.equal(forge.score.verdict, "reject");
  assert.ok(forge.aegis.findings.length > 0);
  assert.ok(forge.strip?.removed.some((r) => r.path.includes(".env")));
});

test("quench fixture hardens", () => {
  const forge = runUntil(loadBundle(createForge(2), FIXTURES[2].build()), "done");
  assert.equal(forge.phase, "done");
  assert.ok(forge.score);
  assert.equal(forge.score.verdict, "hardened");
  assert.ok(forge.pack);
  assert.ok(forge.pack.rewrites.length > 0);
});

test("racy fixture flags concurrency", () => {
  const forge = runUntil(loadBundle(createForge(3), FIXTURES[1].build()), "done");
  assert.ok(forge.striker.findings.some((f) => f.kind === "race" || f.kind === "deadlock"));
  assert.ok((forge.compile?.cycles.length ?? 0) > 0);
});

test("empty bundle merkle is stable and serialize is compact", () => {
  const bundle = ingestFiles("empty", "paste", []);
  const forge = runUntil(loadBundle(createForge(4), bundle), "done");
  const snap = JSON.parse(serialize(forge)) as { merkle: string };
  assert.equal(typeof snap.merkle, "string");
  assert.ok(snap.merkle.length >= 8);
});
