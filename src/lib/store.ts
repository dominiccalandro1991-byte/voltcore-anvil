import { create } from "zustand";
import type { RunMode } from "./engines/constants";
import type { UsseReport, UssePayload } from "./engines/usse";
import type { VectorResult } from "./engines/vste";
import type { Tick } from "./engines/probe";
import type { PhiVector } from "./engines/nase";

export type LiveState = {
  mode: RunMode;
  authorized: boolean;
  frontend: string;
  backend: string;
  specText: string;
  loadLb: number;
  leverM: number;
  agents: number;
  rps: number;
  p99: number;
  errorRate: number;
  yieldPa: number;
  vu: number;
  duration: number;
  ramp: number;
  think: number;
  maxReq: number;
  khC: number;
  khR: number;
  running: boolean;
  aborting: boolean;
  runId: string | null;
  usse: UsseReport | null;
  vectors: VectorResult[];
  ticks: Tick[];
  phi: PhiVector[];
  weighted: number | null;
  sAttest: string | null;
  statusNote: string;
};

const initial: Omit<
  LiveState,
  | "set"
  | "patch"
  | "resetRun"
> = {
  mode: "unified",
  authorized: false,
  frontend: "https://example.com",
  backend: "https://example.com",
  specText: "",
  loadLb: 400,
  leverM: 0.3,
  agents: 12,
  rps: 40,
  p99: 120,
  errorRate: 0.02,
  yieldPa: 2.5e8,
  vu: 8,
  duration: 12,
  ramp: 3,
  think: 50,
  maxReq: 80,
  khC: 20,
  khR: 5,
  running: false,
  aborting: false,
  runId: null,
  usse: null,
  vectors: [],
  ticks: [],
  phi: [],
  weighted: null,
  sAttest: null,
  statusNote: "Idle. Attest ownership, pick a mode, start.",
};

type Store = LiveState & {
  patch: (p: Partial<LiveState>) => void;
  resetRun: () => void;
};

export const useAnvil = create<Store>((set) => ({
  ...initial,
  patch: (p) => set(p),
  resetRun: () =>
    set({
      running: false,
      aborting: false,
      usse: null,
      vectors: [],
      ticks: [],
      statusNote: "Idle.",
    }),
}));
