export const G = 9.80665;
export const LB_TO_KG = 0.45359237;
export const USSE_FAIL_RISK = 0.85;
export const USSE_DIG_SCALE = 50;
export const NASE_DELTA_S = 30;
export const CAUSAL_WP = 0.55;
export const CAUSAL_WD = 0.35;
export const CAUSAL_WI = 0.1;
export const DEFAULT_SECTION_MODULUS = 1e-5;
export const DEFAULT_YIELD_PA = 2.5e8;
export const DEFAULT_LEVER_M = 0.5;
export const DEFAULT_THETA_DEG = 90;

export const PROBE_TIMEOUT_MS = 5000;
export const VSTE_FAULT_TIMEOUT_MS = 10000;
export const PROBE_URL_CAP = 8;
export const RTT_SAMPLES_DEFAULT = 9;
export const RTT_SAMPLES_MIN = 3;
export const RTT_SAMPLES_MAX = 20;
export const VSTE_FUZZ_N = 800;
export const VSTE_MEM_CHUNKS = 48;
export const VSTE_MEM_CHUNK_BYTES = 256 * 1024;
export const VSTE_REPORT_CAP = 40;
export const VSTE_COMPLEXITY_N = [10, 100, 1000] as const;
export const KEYHARBOR_DEFAULT_C = 20;
export const KEYHARBOR_DEFAULT_R = 5;
export const LIVE_VU_MAX = 50;
export const LIVE_DURATION_MAX_S = 120;
export const LIVE_REQUESTS_MAX = 1000;
export const LIVE_BODY_CAP = 64 * 1024;
export const INGEST_BUF = 4096;
export const XAI_CAP = 8;
export const ANOMALY_Z = 2.5;
export const ANOMALY_MZ = 3.5;
export const JACCARD_OVERLAP = 0.35;
export const BEAM_SF_MIN = 2;
export const ENGINE_COUNT = 25;
export const UNIFORM_WEIGHT = 1 / 25;
export const HISTOGRAM_EDGES = [20, 50, 100, 200, 500, 1000, 2000, 5000] as const;
export const USER_AGENT = "VOLTCORE-Engines/1.0";
export const NANO_SANDBOX_API = "https://nano-sandbox-api.onrender.com";
export const VSTE_STORAGE_KEY = "vste-reports-v1";
export const METER_KEY = "vc-engines-meter-v1";

export type RunMode =
  | "physical"
  | "digital"
  | "unified"
  | "live"
  | "virtual"
  | "hybrid";

export type RunStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "aborted"
  | "error";

export type EngineId = "usse-stress" | "vste" | "probe-live" | "hybrid";
