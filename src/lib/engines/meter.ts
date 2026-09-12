import { METER_KEY, XAI_CAP } from "./constants.ts";

export type Meter = { runs: Record<string, number>; xai: number };

function load(): Meter {
  if (typeof localStorage === "undefined") return { runs: {}, xai: 0 };
  try {
    const raw = localStorage.getItem(METER_KEY);
    if (!raw) return { runs: {}, xai: 0 };
    return JSON.parse(raw) as Meter;
  } catch {
    return { runs: {}, xai: 0 };
  }
}

function save(m: Meter) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(METER_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

export function recordRun(id: string): Meter {
  const m = load();
  m.runs[id] = (m.runs[id] ?? 0) + 1;
  save(m);
  return m;
}

export function recordXai(): Meter | null {
  const m = load();
  if (m.xai >= XAI_CAP) return null;
  m.xai += 1;
  save(m);
  return m;
}

export function readMeter(): Meter & { armed: number; totalRuns: number } {
  const m = load();
  const armed = Object.values(m.runs).filter((n) => n > 0).length;
  const totalRuns = Object.values(m.runs).reduce((s, n) => s + n, 0);
  return { ...m, armed, totalRuns };
}
