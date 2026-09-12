import type { UsseReport } from "./usse.ts";
import type { VsteCycle } from "./vste.ts";

export function usseMarkdown(report: UsseReport, source: string): string {
  const p = report.physical;
  const d = report.digital;
  const f = report.fused;
  return [
    "# USSE Stress Report",
    "",
    `- Source: ${source}`,
    `- Mode: ${report.mode}`,
    `- Passed: ${report.passed}`,
    `- Score: ${report.score}`,
    `- Failure risk: ${f.failure_risk.toFixed(6)} (threshold ${report.fail_risk_threshold})`,
    `- NASE: ${report.nase.att_ok ? "fresh" : report.nase.att_reason}`,
    report.error ? `- Error: ${report.error}` : "",
    "",
    "## Physical",
    `- mass_kg: ${p.mass_kg}`,
    `- torque_nm: ${p.torque_nm}`,
    `- moment_nm: ${p.moment_nm}`,
    `- bending_stress_pa: ${p.bending_stress_pa}`,
    `- utilization: ${p.utilization}`,
    `- gravity_force_n: ${p.gravity_force_n}`,
    `- battery_draw_wh: ${p.battery_draw_wh}`,
    "",
    "## Digital",
    `- digital_pressure: ${d.digital_pressure}`,
    `- agent_count: ${d.agent_count}`,
    `- rps: ${d.requests_per_second}`,
    `- p99_ms: ${d.p99_latency_ms}`,
    `- error_rate: ${d.error_rate}`,
    "",
    "## Fused",
    `- physical_risk: ${f.physical_risk}`,
    `- digital_risk: ${f.digital_risk}`,
    `- interaction_risk: ${f.interaction_risk}`,
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function vsteMarkdown(cycle: VsteCycle): string {
  const lines = [
    "# Virtual Stress Test Report",
    "",
    `- ID: ${cycle.id}`,
    `- Created: ${cycle.createdAt}`,
    `- Frontend: ${cycle.targets.frontend}`,
    `- Backend: ${cycle.targets.backend}`,
    `- Total elapsed: ${cycle.cycle.total_elapsed_ms.toFixed(1)} ms`,
    `- Overall success: ${cycle.summary.overall_success.toFixed(4)}`,
    `- Total failures: ${cycle.summary.total_failures}`,
    "",
  ];
  for (const v of cycle.cycle.vectors) {
    lines.push(`## ${v.vector}`);
    lines.push(`- Equation: ${v.equation}`);
    lines.push(`- elapsed_ms: ${v.elapsed_ms}`);
    lines.push(`- samples: ${v.samples}`);
    lines.push(`- failures: ${v.failures}`);
    lines.push(`- success_rate: ${v.success_rate}`);
    if (v.series) lines.push("```json\n" + JSON.stringify(v.series, null, 2) + "\n```");
    if (v.probes) lines.push("```json\n" + JSON.stringify(v.probes, null, 2) + "\n```");
    if (v.failure_telemetry.length)
      lines.push(
        "```json\n" + JSON.stringify(v.failure_telemetry, null, 2) + "\n```",
      );
    lines.push("");
  }
  return lines.join("\n");
}
