import type { AegisState, CompileReport, ForgeScore, StrikerState, StripReport } from "./types.ts";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** O(f) over findings. Produces the forge score field. */
export function scoreForge(
  strip: StripReport,
  compile: CompileReport,
  aegis: AegisState,
  striker: StrikerState,
): ForgeScore {
  let memory = 100;
  for (const f of aegis.findings) {
    if (f.severity === "error") memory -= 18;
    else if (f.severity === "warn") memory -= 8;
  }
  if (aegis.peakBytes > 1_000_000) memory -= 12;

  let concurrency = 100;
  for (const f of striker.findings) {
    if (f.severity === "error") concurrency -= 16;
    else concurrency -= 7;
  }
  if (striker.p99 > 80) concurrency -= Math.min(20, Math.round((striker.p99 - 80) / 8));
  if (striker.dropped) concurrency -= Math.min(15, striker.dropped * 2);

  let compileScore = 100;
  compileScore -= compile.cycles.length * 12;
  compileScore -= Math.min(20, compile.missingDeps.length * 6);
  if (compile.framework === "unknown") compileScore -= 10;
  if (!compile.entry) compileScore -= 8;
  if (!compile.routes.some((r) => r.kind === "ssr" || r.kind === "static" || r.kind === "api")) compileScore -= 6;

  let hygiene = 100;
  const stripped = strip.removed.length;
  hygiene -= Math.min(40, stripped * 12);
  hygiene -= Math.min(24, strip.anomalies.filter((a) => !a.stripped).length * 4);
  if (strip.bytesIn > 0) {
    const ratio = strip.bytesOut / strip.bytesIn;
    if (ratio < 0.7) hygiene -= 8;
  }

  memory = clamp(memory);
  concurrency = clamp(concurrency);
  compileScore = clamp(compileScore);
  hygiene = clamp(hygiene);
  const total = clamp(memory * 0.32 + concurrency * 0.32 + compileScore * 0.2 + hygiene * 0.16);
  const ready = total >= 78 && memory >= 70 && concurrency >= 70;
  const verdict: ForgeScore["verdict"] = ready ? "hardened" : total >= 52 ? "conditional" : "reject";
  return { total, memory, concurrency, compile: compileScore, hygiene, ready, verdict };
}
