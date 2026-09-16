#!/usr/bin/env node
/**
 * VOLTCORE Dual-Rail heartbeat. No secrets.
 * POST /api/v1/events — source must equal Phosphor lane id.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TRUNK = "https://core-api.dominic-calandro1991.workers.dev";
const SOURCE = (process.env.VOLTCORE_LANE || "").trim();
const here = dirname(fileURLToPath(import.meta.url));
const diagPath = join(here, "diagnostics.json");

let diagnostics = {};
if (existsSync(diagPath)) {
  try {
    diagnostics = JSON.parse(readFileSync(diagPath, "utf8"));
  } catch {
    diagnostics = { parse_error: true };
  }
}

if (!SOURCE) {
  console.error("VOLTCORE_LANE required");
  process.exit(1);
}

const incomplete = Boolean(diagnostics.incomplete);
const body = {
  source: SOURCE,
  event_type: incomplete ? "health.diagnostic" : "health.heartbeat",
  severity: incomplete ? "warn" : "info",
  payload: {
    status: incomplete ? "incomplete" : "live",
    surface: "gha",
    interval_s: 60,
    repo: diagnostics.repo || null,
    incomplete,
    missing_dependencies: diagnostics.missing_dependencies || [],
    required_build_specs: diagnostics.required_build_specs || [],
    file_count: diagnostics.file_count ?? null,
    ts: Date.now(),
  },
};

const res = await fetch(`${TRUNK}/api/v1/events`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
if (!res.ok) {
  console.error("trunk", res.status, text.slice(0, 300));
  process.exit(1);
}
console.log("ok", SOURCE, res.status, incomplete ? "diagnostic" : "heartbeat");
