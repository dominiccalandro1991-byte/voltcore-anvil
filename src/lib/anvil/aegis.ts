import { mulberry32 } from "./hash.ts";
import type { AegisFinding, AegisState, Anomaly, CompileReport, StripReport } from "./types.ts";

export const AEGIS_TICKS = 48;
const HEAP_CAP = 2_097_152;
const SAMPLE_CAP = 64;

export function emptyAegis(): AegisState {
  return {
    tick: 0,
    liveBytes: 0,
    peakBytes: 0,
    allocCount: 0,
    freeCount: 0,
    samples: [],
    findings: [],
    done: false,
  };
}

interface Pressure {
  leakRate: number;
  churn: number;
  uaf: boolean;
  capRisk: boolean;
}

function pressureFrom(strip: StripReport, compile: CompileReport): Pressure {
  let leakRate = 120 + compile.complexity * 4;
  let churn = 400 + compile.complexity * 2;
  let uaf = false;
  let capRisk = false;
  for (const a of strip.anomalies) {
    if (a.kind === "interval_leak" || a.kind === "listener_leak") leakRate += 2800;
    if (a.kind === "unbounded_growth") {
      leakRate += 5200;
      capRisk = true;
    }
    if (a.kind === "eval") uaf = true;
  }
  return { leakRate, churn, uaf, capRisk };
}

function pushFinding(state: AegisState, finding: AegisFinding) {
  if (state.findings.some((f) => f.kind === finding.kind && f.detail === finding.detail)) return;
  state.findings = state.findings.concat(finding);
}

/** One Aegis quantum. O(1) amortized (ring-capped samples). */
export function stepAegis(
  state: AegisState,
  strip: StripReport,
  compile: CompileReport,
  seed: number,
): AegisState {
  if (state.done) return state;
  const rng = mulberry32(seed ^ (state.tick * 9973 + 13));
  const p = pressureFrom(strip, compile);
  const next: AegisState = {
    ...state,
    tick: state.tick + 1,
    samples: state.samples.slice(),
    findings: state.findings.slice(),
  };
  const alloc = Math.floor(p.churn * (0.6 + rng() * 0.8));
  const leak = Math.floor(p.leakRate * (0.85 + rng() * 0.4));
  const free = Math.max(0, Math.floor(alloc * (0.55 + rng() * 0.25) - leak * 0.15));
  next.allocCount += 1;
  next.freeCount += free > 0 ? 1 : 0;
  next.liveBytes = Math.max(0, next.liveBytes + alloc - free + leak);
  if (next.liveBytes > next.peakBytes) next.peakBytes = next.liveBytes;
  next.samples.push({ t: next.tick, liveBytes: next.liveBytes, allocs: alloc, frees: free });
  if (next.samples.length > SAMPLE_CAP) next.samples.splice(0, next.samples.length - SAMPLE_CAP);

  if (next.liveBytes > HEAP_CAP) {
    pushFinding(next, { kind: "heap_cap", detail: `Live heap exceeded ${HEAP_CAP} B cap`, severity: "error" });
  }
  if (next.tick >= 12) {
    const a = next.samples[0];
    const b = next.samples[next.samples.length - 1];
    if (a && b) {
      const slope = (b.liveBytes - a.liveBytes) / Math.max(1, b.t - a.t);
      if (slope > 1800) {
        pushFinding(next, {
          kind: "growth_slope",
          detail: `Heap slope ${Math.round(slope)} B/tick — leak signature`,
          severity: "error",
        });
      }
    }
  }
  if (p.uaf && next.tick === 16) {
    pushFinding(next, { kind: "use_after_free", detail: "Freed closure still reached via eval path", severity: "error" });
  }
  for (const a of strip.anomalies as Anomaly[]) {
    if (a.kind === "interval_leak" || a.kind === "listener_leak" || a.kind === "unbounded_growth") {
      pushFinding(next, { kind: a.kind, detail: `${a.path}:${a.line} ${a.detail}`, severity: "warn" });
    }
  }
  if (p.capRisk && next.tick > 24 && next.liveBytes > 400_000) {
    pushFinding(next, { kind: "unbounded_growth", detail: "Growth did not bound under load", severity: "error" });
  }
  if (next.tick >= AEGIS_TICKS) next.done = true;
  return next;
}
