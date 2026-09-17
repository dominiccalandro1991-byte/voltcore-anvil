/** VoltCore Anvil — HammerForge contracts. Framework-agnostic. */

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type JsonMap = { [key: string]: Json };

export type ForgePhase =
  | "idle"
  | "ingest"
  | "strip"
  | "compile"
  | "stress"
  | "score"
  | "pack"
  | "sync"
  | "done"
  | "failed";

export type LaneRail = "edge" | "trunk" | "product" | "studio";

export interface FleetSpec {
  repo: string;
  paths: string[];
  group: string;
  groupLabel: string;
  rail: LaneRail;
}

export interface VirtualFile {
  path: string;
  content: string;
  size: number;
  hash: string;
}

export interface IngestedBundle {
  name: string;
  origin: "fixture" | "drop" | "paste" | "mesh";
  files: VirtualFile[];
  merkle: string;
  bytes: number;
  ingestedAt: number;
}

export type AnomalyKind =
  | "secret"
  | "forbidden_path"
  | "eval"
  | "unbounded_growth"
  | "listener_leak"
  | "interval_leak"
  | "race_shared"
  | "missing_await"
  | "circular_import"
  | "missing_manifest"
  | "dead_dep"
  | "buffer_overrun";

export interface Anomaly {
  kind: AnomalyKind;
  path: string;
  line: number;
  detail: string;
  stripped: boolean;
}

export interface StripReport {
  kept: VirtualFile[];
  removed: { path: string; reason: string }[];
  anomalies: Anomaly[];
  bytesIn: number;
  bytesOut: number;
}

export type RouteKind = "static" | "ssr" | "api" | "edge" | "asset";

export interface CompiledRoute {
  path: string;
  kind: RouteKind;
  file: string;
  dynamic: boolean;
}

export interface DepNode {
  path: string;
  imports: string[];
}

export interface CompileReport {
  framework: "tanstack-start" | "vite" | "next" | "html" | "unknown";
  entry: string | null;
  routes: CompiledRoute[];
  graph: DepNode[];
  cycles: string[][];
  missingDeps: string[];
  declaredDeps: string[];
  complexity: number;
}

export interface Alloc {
  id: number;
  file: string;
  size: number;
  live: boolean;
  born: number;
  died: number | null;
  kind: "heap" | "listener" | "timer" | "buffer";
}

export interface AegisSample {
  t: number;
  liveBytes: number;
  allocs: number;
  frees: number;
}

export interface AegisFinding {
  kind: AnomalyKind | "use_after_free" | "growth_slope" | "heap_cap";
  detail: string;
  severity: "info" | "warn" | "error";
}

export interface AegisState {
  tick: number;
  liveBytes: number;
  peakBytes: number;
  allocCount: number;
  freeCount: number;
  samples: AegisSample[];
  findings: AegisFinding[];
  done: boolean;
}

export interface LatencyHit {
  t: number;
  ms: number;
  worker: number;
  ok: boolean;
}

export interface StrikerFinding {
  kind: "deadlock" | "race" | "saturation" | "tail_latency" | "drop";
  detail: string;
  severity: "info" | "warn" | "error";
}

export interface StrikerState {
  tick: number;
  workers: number;
  inflight: number;
  completed: number;
  dropped: number;
  samples: LatencyHit[];
  p50: number;
  p95: number;
  p99: number;
  utilization: number;
  findings: StrikerFinding[];
  done: boolean;
}

export interface ForgeScore {
  total: number;
  memory: number;
  concurrency: number;
  compile: number;
  hygiene: number;
  ready: boolean;
  verdict: "hardened" | "conditional" | "reject";
}

export interface VercelRoute {
  src: string;
  dest?: string;
  headers?: Record<string, string>;
  continue?: boolean;
}

export interface VercelManifest {
  version: 3;
  name: string;
  framework: string;
  builds: { src: string; use: string }[];
  routes: VercelRoute[];
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
  output: "static" | "ssr" | "hybrid";
  regions: string[];
  notes: string[];
}

export interface ForgeEvent {
  t: number;
  phase: ForgePhase;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ForgeState {
  id: string;
  seed: number;
  phase: ForgePhase;
  tick: number;
  bundle: IngestedBundle | null;
  strip: StripReport | null;
  compile: CompileReport | null;
  aegis: AegisState;
  striker: StrikerState;
  score: ForgeScore | null;
  pack: VercelManifest | null;
  log: ForgeEvent[];
  startedAt: number;
  finishedAt: number | null;
  meshPosted: boolean;
}

export interface MeshEvent {
  id: string;
  created_at: string;
  source: string;
  event_type: string;
  severity: string;
  payload: JsonMap;
}

export interface FleetSnapshot {
  status: string;
  fleet?: string[];
  lattice?: string[];
  lanes?: number;
  mesh: boolean;
  trunk: boolean;
  neural: boolean;
  openrouter: boolean;
  supabase: boolean;
  cron?: boolean;
}

export interface RunRecord {
  id: string;
  name: string;
  at: number;
  score: number;
  verdict: ForgeScore["verdict"];
  merkle: string;
}
