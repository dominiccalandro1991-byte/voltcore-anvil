import type { RunMode, RunStatus, EngineId } from "./engines/constants";

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type RunRow = {
  id: string;
  user_id: string;
  mode: RunMode;
  engine: EngineId;
  target_frontend: string | null;
  target_backend: string | null;
  authorized: boolean;
  started_at: string;
  ended_at: string | null;
  status: RunStatus;
  vu_count: number;
  duration_s: number;
  ramp_s: number;
  think_ms: number;
  max_requests: number;
  requests: number;
  errors: number;
  shed_429: number;
  rps_peak: number;
  error_rate: number;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  overall_success: number | null;
  failure_risk: number | null;
  s_attest: string | null;
  weighted_sum: number | null;
  attestation_ok: boolean;
  summary: Json;
  created_at: string;
};

export type TickRow = {
  id: string;
  run_id: string;
  t_ms: number;
  inflight: number;
  rps: number;
  error_rate: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  ok: number;
  err: number;
  shed: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  status_0: number;
};

export type VectorRow = {
  id: string;
  run_id: string;
  vector: string;
  equation: string;
  elapsed_ms: number;
  samples: number;
  failures: number;
  success_rate: number;
  latency_p50: number | null;
  latency_p95: number | null;
  latency_p99: number | null;
  heap_before: Json;
  heap_after: Json;
  series: Json;
  probes: Json;
  network_rtt: Json;
  failure_telemetry: Json;
  extra: Json;
};

export type ThreadRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};
