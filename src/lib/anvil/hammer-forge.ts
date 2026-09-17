import { emptyAegis, stepAegis } from "./aegis.ts";
import { compileBundle } from "./compile.ts";
import { uuid } from "./hash.ts";
import { packManifest } from "./pack.ts";
import { scoreForge } from "./score.ts";
import { emptyStriker, stepStriker } from "./striker.ts";
import { stripBundle } from "./strip.ts";
import type { ForgeEvent, ForgePhase, ForgeState, IngestedBundle } from "./types.ts";

const PHASES: ForgePhase[] = ["ingest", "strip", "compile", "stress", "score", "pack", "sync", "done"];

function log(state: ForgeState, level: ForgeEvent["level"], message: string): ForgeState {
  return {
    ...state,
    log: state.log.concat({ t: Date.now(), phase: state.phase, level, message }).slice(-80),
  };
}

/** O(1). Fresh forge, idle until a bundle is loaded. */
export function createForge(seed = (0xa711 ^ Date.now()) >>> 0): ForgeState {
  return {
    id: uuid(),
    seed: seed >>> 0,
    phase: "idle",
    tick: 0,
    bundle: null,
    strip: null,
    compile: null,
    aegis: emptyAegis(),
    striker: emptyStriker(),
    score: null,
    pack: null,
    log: [],
    startedAt: Date.now(),
    finishedAt: null,
    meshPosted: false,
  };
}

/** O(1). Bind an ingested bundle and arm the pipeline. */
export function loadBundle(state: ForgeState, bundle: IngestedBundle): ForgeState {
  const next: ForgeState = {
    ...createForge(state.seed ^ bundle.merkle.length * 0x9e37),
    bundle,
    phase: "ingest",
    startedAt: Date.now(),
  };
  return log(next, "info", `Ingested ${bundle.files.length} files · ${bundle.bytes} B · merkle ${bundle.merkle}`);
}

function advancePhase(state: ForgeState, phase: ForgePhase): ForgeState {
  return { ...state, phase, tick: state.tick + 1 };
}

/** One pipeline quantum. Hot path O(1) during stress; O(n) on ingest/strip/compile. */
export function step(state: ForgeState): ForgeState {
  if (state.phase === "idle" || state.phase === "done" || state.phase === "failed") return state;
  const bundle = state.bundle;
  if (!bundle) return { ...state, phase: "failed" };

  if (state.phase === "ingest") {
    return log(advancePhase(state, "strip"), "info", "Strip pass — FORBID + credential scan");
  }

  if (state.phase === "strip") {
    const strip = stripBundle(bundle);
    let next: ForgeState = { ...advancePhase(state, "compile"), strip };
    next = log(next, "info", `Kept ${strip.kept.length}/${bundle.files.length} · stripped ${strip.removed.length}`);
    if (strip.removed.length) next = log(next, "warn", `Removed ${strip.removed.map((r) => r.path).join(", ")}`);
    return next;
  }

  if (state.phase === "compile") {
    if (!state.strip) return { ...state, phase: "failed" };
    const compile = compileBundle(state.strip);
    let next: ForgeState = { ...advancePhase(state, "stress"), compile, aegis: emptyAegis(), striker: emptyStriker() };
    next = log(
      next,
      "info",
      `Compile ${compile.framework} · ${compile.routes.length} routes · complexity ${compile.complexity}`,
    );
    if (compile.cycles.length) next = log(next, "warn", `${compile.cycles.length} import cycle(s)`);
    return next;
  }

  if (state.phase === "stress") {
    if (!state.strip || !state.compile) return { ...state, phase: "failed" };
    const aegis = stepAegis(state.aegis, state.strip, state.compile, state.seed);
    const striker = stepStriker(state.striker, state.strip, state.compile, state.seed ^ 0x51ed);
    let next: ForgeState = { ...state, aegis, striker, tick: state.tick + 1 };
    if (aegis.done && striker.done) {
      next = advancePhase({ ...next, phase: "stress" }, "score");
      next = log(next, "info", `Dual testers complete · Aegis ${aegis.findings.length} · Striker ${striker.findings.length}`);
    }
    return next;
  }

  if (state.phase === "score") {
    if (!state.strip || !state.compile) return { ...state, phase: "failed" };
    const score = scoreForge(state.strip, state.compile, state.aegis, state.striker);
    let next = { ...advancePhase(state, "pack"), score };
    return log(next, score.ready ? "info" : "warn", `Forge ${score.verdict} · ${score.total}/100`);
  }

  if (state.phase === "pack") {
    if (!state.compile || !state.score) return { ...state, phase: "failed" };
    const pack = packManifest(bundle, state.compile, state.score);
    let next = { ...advancePhase(state, "sync"), pack };
    return log(next, "info", `Packed ${pack.output} · ${pack.rewrites.length} rewrites`);
  }

  if (state.phase === "sync") {
    const next = { ...advancePhase(state, "done"), finishedAt: Date.now() };
    return log(next, "info", "Ready for mesh POST /api/v1/events");
  }

  return state;
}

/** Drive until a phase (or done). Stress is 48+48 dual ticks. O(ticks). */
export function runUntil(state: ForgeState, stop: ForgePhase = "done", budget = 200): ForgeState {
  let cur = state;
  let n = 0;
  while (n++ < budget && cur.phase !== stop && cur.phase !== "done" && cur.phase !== "failed" && cur.phase !== "idle") {
    cur = step(cur);
  }
  return cur;
}

export function serialize(state: ForgeState): string {
  return JSON.stringify({
    id: state.id,
    seed: state.seed,
    phase: state.phase,
    tick: state.tick,
    merkle: state.bundle?.merkle ?? null,
    score: state.score,
    pack: state.pack,
    aegis: { peak: state.aegis.peakBytes, findings: state.aegis.findings.length },
    striker: { p99: state.striker.p99, findings: state.striker.findings.length },
  });
}

export function phaseIndex(phase: ForgePhase): number {
  const i = PHASES.indexOf(phase);
  return i < 0 ? 0 : i;
}

export { PHASES };
