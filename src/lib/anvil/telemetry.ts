import { ANVIL_SOURCE, LANE_CEILING, TRUNK_ORIGIN } from "./fleet.ts";
import type { FleetSnapshot, ForgeScore, ForgeState, JsonMap, MeshEvent } from "./types.ts";

export interface BeatBody {
  source: string;
  type: string;
  severity: "info" | "error" | "critical";
  payload: JsonMap;
}

export function heartbeatBody(): BeatBody {
  return {
    source: ANVIL_SOURCE,
    type: "health.heartbeat",
    severity: "info",
    payload: {
      status: "live",
      surface: "anvil",
      interval_s: 60,
      incomplete: false,
      missing_dependencies: [],
      required_build_specs: [],
      ts: Date.now(),
    },
  };
}

export function forgeEventBody(state: ForgeState): BeatBody {
  const score: ForgeScore | null = state.score;
  const ready = Boolean(score?.ready);
  return {
    source: ANVIL_SOURCE,
    type: state.phase === "done" ? "anvil.forge.complete" : "anvil.forge.progress",
    severity: score && score.verdict === "reject" ? "error" : "info",
    payload: {
      status: ready ? "live" : state.phase === "failed" ? "failed" : "hardening",
      surface: "anvil",
      forge_id: state.id,
      phase: state.phase,
      merkle: state.bundle?.merkle ?? null,
      bundle: state.bundle?.name ?? null,
      score: score?.total ?? null,
      verdict: score?.verdict ?? null,
      memory: score?.memory ?? null,
      concurrency: score?.concurrency ?? null,
      output: state.pack?.output ?? null,
      lanes: LANE_CEILING,
      incomplete: false,
      ts: Date.now(),
    },
  };
}

export async function postEvent(body: BeatBody): Promise<{ ok: boolean; status: number; detail: string }> {
  try {
    const res = await fetch(`${TRUNK_ORIGIN}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, detail: text.slice(0, 240) };
  } catch (err) {
    return { ok: false, status: 0, detail: err instanceof Error ? err.message : "offline" };
  }
}

export async function pullHealth(): Promise<FleetSnapshot | null> {
  try {
    const res = await fetch(`${TRUNK_ORIGIN}/api/v1/health`);
    if (!res.ok) return null;
    return (await res.json()) as FleetSnapshot;
  } catch {
    return null;
  }
}

export async function pullEvents(limit = 150): Promise<MeshEvent[]> {
  try {
    const res = await fetch(`${TRUNK_ORIGIN}/api/v1/events?limit=${limit}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { events?: MeshEvent[] };
    return (body.events || []).map((e) => ({
      id: String(e.id),
      created_at: String(e.created_at),
      source: String(e.source || "_unmapped"),
      event_type: String(e.event_type || "event"),
      severity: String(e.severity || "info"),
      payload: e.payload && typeof e.payload === "object" ? e.payload : {},
    }));
  } catch {
    return [];
  }
}

export function latticeIds(fleet: FleetSnapshot | null): string[] {
  if (!fleet) return [];
  return fleet.lattice ?? fleet.fleet ?? [];
}
