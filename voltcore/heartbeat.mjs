#!/usr/bin/env node
/**
 * VoltCore Anvil → Dual-Rail trunk. In-process timer or `node voltcore/heartbeat.mjs --loop`.
 * Never a GitHub Actions minute cron.
 */
const TRUNK = (process.env.VOLTCORE_TRUNK || "https://core-api.dominic-calandro1991.workers.dev").replace(/\/$/, "");
const SOURCE = process.env.VOLTCORE_SOURCE || "voltcore-anvil";
const INTERVAL_MS = Number(process.env.VOLTCORE_INTERVAL_MS || 60_000);

export function beatBody({ incomplete = false, surface = "node" } = {}) {
  return {
    source: SOURCE,
    type: incomplete ? "health.diagnostic" : "health.heartbeat",
    severity: "info",
    payload: {
      status: incomplete ? "incomplete" : "live",
      surface,
      interval_s: Math.round(INTERVAL_MS / 1000),
      incomplete,
      missing_dependencies: incomplete ? ["runtime verified"] : [],
      required_build_specs: incomplete
        ? ["package.json", "src tree", "voltcore/heartbeat.mjs"]
        : [],
    },
  };
}

export async function beat(opts = {}) {
  const res = await fetch(`${TRUNK}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(beatBody(opts)),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text.slice(0, 400) };
}

export function startHeartbeat(opts = {}) {
  const tick = () => {
    void beat(opts).catch(() => {});
  };
  tick();
  return setInterval(tick, INTERVAL_MS);
}

const isCli = process.argv[1] && /heartbeat\.mjs$/.test(process.argv[1]);
if (isCli) {
  const incomplete = process.argv.includes("--diagnostic");
  const loop = process.argv.includes("--loop");
  const run = async () => {
    const result = await beat({ incomplete, surface: "node" });
    console.log(JSON.stringify(result));
    if (!result.ok && !loop) process.exit(1);
  };
  await run();
  if (loop) setInterval(() => void run(), INTERVAL_MS);
}
