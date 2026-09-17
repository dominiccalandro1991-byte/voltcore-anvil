import { create } from "zustand";
import { FIXTURES } from "./fixtures.ts";
import { ANVIL_SOURCE, FLEET, LANE_CEILING, STALE_MS } from "./fleet.ts";
import { createForge, loadBundle, step } from "./hammer-forge.ts";
import { filesFromDrop, ingestFiles, parsePasteTree } from "./ingest.ts";
import { forgeEventBody, heartbeatBody, latticeIds, postEvent, pullEvents, pullHealth } from "./telemetry.ts";
import type { FleetSnapshot, ForgeState, MeshEvent, RunRecord } from "./types.ts";

export type LinkState = "offline" | "syncing" | "live" | "local";

export interface LaneView {
  id: string;
  group: string;
  groupLabel: string;
  lastT: number | null;
  tone: "idle" | "live" | "stale" | "danger";
}

export function laneViews(events: MeshEvent[], now: number, lattice: string[]): LaneView[] {
  const ids = lattice.length ? lattice : Object.keys(FLEET);
  const latest = new Map<string, MeshEvent>();
  for (const e of events) {
    const prev = latest.get(e.source);
    if (!prev || e.created_at > prev.created_at) latest.set(e.source, e);
  }
  return ids.map((id) => {
    const spec = FLEET[id];
    const ev = latest.get(id);
    const lastT = ev ? Date.parse(ev.created_at) : null;
    let tone: LaneView["tone"] = "idle";
    if (ev) {
      const sev = ev.severity;
      if (sev === "error" || sev === "critical" || sev === "fatal") tone = "danger";
      else if (lastT != null && now - lastT > STALE_MS) tone = "stale";
      else tone = "live";
    }
    return {
      id,
      group: spec?.group ?? "unmapped",
      groupLabel: spec?.groupLabel ?? "Unmapped",
      lastT,
      tone,
    };
  });
}

const HISTORY_KEY = "voltcore-anvil-history";

export function readHistory(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function writeHistory(rows: RunRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 8)));
}

interface AnvilStore {
  forge: ForgeState;
  running: boolean;
  link: LinkState;
  health: FleetSnapshot | null;
  events: MeshEvent[];
  lanes: LaneView[];
  history: RunRecord[];
  selectedLane: string | null;
  paste: string;
  fixtureId: string;
  lastPost: string | null;
  strike: () => void;
  stop: () => void;
  tick: () => void;
  loadFixture: (id: string) => void;
  loadPaste: () => void;
  loadDrop: (files: FileList) => Promise<void>;
  selectLane: (id: string | null) => void;
  setPaste: (v: string) => void;
  seedMesh: (health: FleetSnapshot | null, events: MeshEvent[], now?: number) => void;
  hydrateHistory: () => void;
  syncMesh: () => Promise<void>;
  beat: () => Promise<void>;
}

let loop: number | null = null;

function recordRun(forge: ForgeState, history: RunRecord[]): RunRecord[] {
  if (!forge.score || !forge.bundle) return history;
  const row: RunRecord = {
    id: forge.id,
    name: forge.bundle.name,
    at: forge.finishedAt ?? Date.now(),
    score: forge.score.total,
    verdict: forge.score.verdict,
    merkle: forge.bundle.merkle,
  };
  const next = [row, ...history.filter((h) => h.id !== row.id)].slice(0, 8);
  writeHistory(next);
  return next;
}

export const useAnvil = create<AnvilStore>()((set, get) => ({
  forge: loadBundle(createForge(0x51ed), FIXTURES[0].build()),
  running: true,
  link: "syncing",
  health: null,
  events: [],
  lanes: laneViews([], Date.now(), Object.keys(FLEET)),
  history: [],
  selectedLane: ANVIL_SOURCE,
  paste: "",
  fixtureId: "leaky-spa",
  lastPost: null,

  seedMesh(health, events, now = Date.now()) {
    const lattice = latticeIds(health);
    set({
      health,
      events,
      lanes: laneViews(events, now, lattice.length ? lattice : Object.keys(FLEET)),
      link: health ? "live" : "local",
    });
  },

  hydrateHistory() {
    set({ history: readHistory() });
  },

  strike() {
    const { forge } = get();
    if (!forge.bundle) return;
    set({ forge: loadBundle(createForge(), forge.bundle), running: true });
  },

  stop() {
    set({ running: false });
  },

  tick() {
    const { forge, running } = get();
    if (!running) return;
    if (forge.phase === "done" || forge.phase === "failed" || forge.phase === "idle") {
      set({ running: false });
      if (forge.phase === "done" && !forge.meshPosted) {
        void (async () => {
          const posted = await postEvent(forgeEventBody(forge));
          set((s) => ({
            forge: { ...s.forge, meshPosted: posted.ok },
            lastPost: posted.ok ? `trunk ${posted.status}` : `local ${posted.detail}`,
            history: recordRun(s.forge, s.history),
            link: posted.ok ? "live" : s.link === "live" ? "live" : "local",
          }));
        })();
      }
      return;
    }
    set({ forge: step(forge) });
  },

  loadFixture(id) {
    const fix = FIXTURES.find((f) => f.id === id) ?? FIXTURES[0];
    set({
      fixtureId: fix.id,
      forge: loadBundle(createForge(), fix.build()),
      running: true,
    });
  },

  loadPaste() {
    const raw = parsePasteTree(get().paste);
    if (!raw.length) return;
    const bundle = ingestFiles("paste-tree", "paste", raw);
    set({ forge: loadBundle(createForge(), bundle), running: true });
  },

  async loadDrop(files) {
    const raw = await filesFromDrop(files);
    if (!raw.length) return;
    const bundle = ingestFiles(files[0]?.name ?? "drop", "drop", raw);
    set({ forge: loadBundle(createForge(), bundle), running: true });
  },

  selectLane(id) {
    set({ selectedLane: id });
  },

  setPaste(v) {
    set({ paste: v });
  },

  async syncMesh() {
    set({ link: "syncing" });
    const [health, events] = await Promise.all([pullHealth(), pullEvents(200)]);
    const lattice = latticeIds(health);
    const now = Date.now();
    set({
      health,
      events,
      lanes: laneViews(events, now, lattice.length ? lattice : Object.keys(FLEET)),
      link: health ? "live" : "local",
    });
  },

  async beat() {
    const posted = await postEvent(heartbeatBody());
    set({
      lastPost: posted.ok ? `beat ${posted.status}` : `beat-local ${posted.detail}`,
      link: posted.ok ? "live" : get().health ? "live" : "local",
    });
  },
}));

export function startForgeLoop() {
  if (loop != null) return;
  const pulse = () => {
    useAnvil.getState().tick();
    loop = window.setTimeout(pulse, 42);
  };
  pulse();
}

export function stopForgeLoop() {
  if (loop != null) {
    window.clearTimeout(loop);
    loop = null;
  }
}

export { LANE_CEILING };
