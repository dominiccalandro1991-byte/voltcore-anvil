import {
  CAUSAL_WD,
  CAUSAL_WI,
  CAUSAL_WP,
  DEFAULT_LEVER_M,
  DEFAULT_SECTION_MODULUS,
  DEFAULT_THETA_DEG,
  DEFAULT_YIELD_PA,
  G,
  LB_TO_KG,
  NASE_DELTA_S,
  USSE_DIG_SCALE,
  USSE_FAIL_RISK,
  type RunMode,
} from "./constants.ts";
import { clamp, round6 } from "./hash.ts";

export type UssePayload = {
  source: string;
  force_n: number;
  lever_arm_m: number;
  theta_deg: number;
  mass_kg: number;
  load_lb: number;
  duration_h: number;
  power_w: number;
  section_modulus_m3: number;
  yield_stress_pa: number;
  agent_count: number;
  requests_per_second: number;
  p99_latency_ms: number;
  error_rate: number;
  notes: string[];
  mode: "physical" | "digital" | "unified";
  attestation_timestamp: number;
  causal_weights?: { physical: number; digital: number; interaction: number };
};

export type PhysicalStress = {
  torque_nm: number;
  moment_nm: number;
  bending_stress_pa: number;
  battery_draw_wh: number;
  mass_kg: number;
  utilization: number;
  gravity_force_n: number;
};

export type DigitalLoad = {
  digital_pressure: number;
  agent_count: number;
  requests_per_second: number;
  p99_latency_ms: number;
  error_rate: number;
};

export type FusedRisk = {
  failure_risk: number;
  physical_risk: number;
  digital_risk: number;
  interaction_risk: number;
};

export type NaseGate = {
  att_ok: boolean;
  att_reason: string;
  delta_seconds: number;
};

export type UsseReport = {
  physical: PhysicalStress;
  digital: DigitalLoad;
  fused: FusedRisk;
  nase: NaseGate;
  mode: "physical" | "digital" | "unified";
  fail_risk_threshold: number;
  score: number | null;
  passed: boolean;
  error: string | null;
};

export function emptyPayload(partial: Partial<UssePayload> = {}): UssePayload {
  return {
    source: "pasted-spec",
    force_n: 0,
    lever_arm_m: DEFAULT_LEVER_M,
    theta_deg: DEFAULT_THETA_DEG,
    mass_kg: 0,
    load_lb: 0,
    duration_h: 1,
    power_w: 0,
    section_modulus_m3: DEFAULT_SECTION_MODULUS,
    yield_stress_pa: DEFAULT_YIELD_PA,
    agent_count: 0,
    requests_per_second: 0,
    p99_latency_ms: 0,
    error_rate: 0,
    notes: [],
    mode: "unified",
    attestation_timestamp: Math.floor(Date.now() / 1000),
    ...partial,
  };
}

const FAMILIES = [
  /physics|rigid|soft\s*body|collision|gravity|torque|lever|load|mass|force|stress|strain/i,
  /entity|tick\s*rate|simulation|game\s*loop|world\s*step/i,
  /galactic|domination|planet\s*builder|spaceship|thruster/i,
  /yield\s*stress|section\s*modulus|bending|moment/i,
  /agent_count|requests_per_second|p99|latency/i,
];

export function looksLikeSpec(text: string, _filename = ""): boolean {
  if (text.length < 40) return false;
  let hits = 0;
  for (const re of FAMILIES) if (re.test(text)) hits += 1;
  return hits >= 2;
}

export function parseSpec(text: string, filename = ""): UssePayload {
  const p = emptyPayload({
    source: filename || (text.trim() ? "pasted-spec" : "chat-intent"),
  });
  const lb = text.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds)\b/i);
  if (lb) {
    p.load_lb = Number(lb[1]);
    p.mass_kg = p.load_lb * LB_TO_KG;
  }
  if (p.mass_kg === 0) {
    const kg = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
    if (kg) p.mass_kg = Number(kg[1]);
  }
  const n = text.match(/(\d+(?:\.\d+)?)\s*(?:N|newtons)\b/i);
  if (n) p.force_n = Number(n[1]);
  const lever = text.match(
    /(?:lever|arm|moment\s*arm)[^\d]{0,24}(\d+(?:\.\d+)?)\s*m\b/i,
  );
  if (lever) p.lever_arm_m = Number(lever[1]);
  const agents = text.match(/(\d+)\s*(?:agents|entities|npcs)\b/i);
  if (agents) p.agent_count = Number(agents[1]);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hours|hrs)\b/i);
  if (hours) p.duration_h = Number(hours[1]);
  if (p.load_lb === 0 && /400\/450\/500\s*lb|heavy\s*load/i.test(text)) {
    p.load_lb = 400;
    p.mass_kg = p.load_lb * LB_TO_KG;
  }
  const rps = text.match(/(\d+(?:\.\d+)?)\s*(?:rps|req(?:uests)?\/s)/i);
  if (rps) p.requests_per_second = Number(rps[1]);
  const p99 = text.match(/p99[^\d]{0,8}(\d+(?:\.\d+)?)/i);
  if (p99) p.p99_latency_ms = Number(p99[1]);
  return p;
}

export const USSE_INTENT =
  /\b(usse|stress|torque|load_?lb|500\s*lb|300\s*lb)\b/i;

export function checkAttestationFreshness(
  timestamp: number,
  deltaSeconds = NASE_DELTA_S,
  now = Date.now() / 1000,
): NaseGate {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return {
      att_ok: false,
      att_reason: "missing attestation_timestamp",
      delta_seconds: deltaSeconds,
    };
  }
  const age = now - timestamp;
  if (age > deltaSeconds) {
    return {
      att_ok: false,
      att_reason: `stale attestation age=${age.toFixed(1)}s > ${deltaSeconds}s`,
      delta_seconds: deltaSeconds,
    };
  }
  if (age < -5) {
    return {
      att_ok: false,
      att_reason: "attestation timestamp in the future",
      delta_seconds: deltaSeconds,
    };
  }
  return { att_ok: true, att_reason: "fresh", delta_seconds: deltaSeconds };
}

export function computePhysicalStress(p: UssePayload): PhysicalStress {
  let mass = p.mass_kg;
  if (mass <= 0 && p.load_lb) mass = p.load_lb * LB_TO_KG;
  const thetaRad = (p.theta_deg * Math.PI) / 180;
  const torque_nm = p.force_n * p.lever_arm_m * Math.sin(thetaRad);
  const gravity_force_n = mass * G;
  const effective_force = p.force_n > 0 ? p.force_n : gravity_force_n;
  const moment_nm = effective_force * p.lever_arm_m;
  const bending_stress_pa = moment_nm / Math.max(p.section_modulus_m3, 1e-12);
  const battery_draw_wh = p.power_w * p.duration_h;
  const utilization =
    p.yield_stress_pa > 0 ? bending_stress_pa / p.yield_stress_pa : 0;
  return {
    torque_nm,
    moment_nm,
    bending_stress_pa,
    battery_draw_wh,
    mass_kg: mass,
    utilization,
    gravity_force_n,
  };
}

export function computeDigitalLoad(p: UssePayload): DigitalLoad {
  const digital_pressure =
    p.agent_count *
    (1 + p.requests_per_second / 100) *
    (1 + p.p99_latency_ms / 1000) *
    (1 + 5 * p.error_rate);
  return {
    digital_pressure,
    agent_count: p.agent_count,
    requests_per_second: p.requests_per_second,
    p99_latency_ms: p.p99_latency_ms,
    error_rate: p.error_rate,
  };
}

export function fuseFailureRisk(
  phys: PhysicalStress,
  dig: DigitalLoad,
  weights?: { physical: number; digital: number; interaction: number },
): FusedRisk {
  const wp = weights?.physical ?? CAUSAL_WP;
  const wd = weights?.digital ?? CAUSAL_WD;
  const wi = weights?.interaction ?? CAUSAL_WI;
  const physical_risk = Math.min(1, clamp(phys.utilization, 0, 2));
  const digital_risk = Math.min(1, dig.digital_pressure / USSE_DIG_SCALE);
  const interaction_risk = physical_risk * digital_risk;
  const failure_risk = clamp(
    wp * physical_risk + wd * digital_risk + wi * interaction_risk,
    0,
    1,
  );
  return { failure_risk, physical_risk, digital_risk, interaction_risk };
}

export function runUsse(
  payload: UssePayload,
  opts?: { now?: number; deltaSeconds?: number },
): UsseReport {
  const nase = checkAttestationFreshness(
    payload.attestation_timestamp,
    opts?.deltaSeconds ?? NASE_DELTA_S,
    opts?.now,
  );
  const mode = payload.mode;
  if (!nase.att_ok) {
    return {
      physical: computePhysicalStress(emptyPayload()),
      digital: computeDigitalLoad(emptyPayload()),
      fused: {
        failure_risk: 1,
        physical_risk: 0,
        digital_risk: 0,
        interaction_risk: 0,
      },
      nase,
      mode,
      fail_risk_threshold: USSE_FAIL_RISK,
      score: null,
      passed: false,
      error: `NASE attestation-freshness failed: ${nase.att_reason}`,
    };
  }
  const physical =
    mode === "digital"
      ? computePhysicalStress(emptyPayload())
      : computePhysicalStress(payload);
  const digital =
    mode === "physical"
      ? computeDigitalLoad(emptyPayload())
      : computeDigitalLoad(payload);
  const fused = fuseFailureRisk(physical, digital, payload.causal_weights);
  const passed = fused.failure_risk < USSE_FAIL_RISK && nase.att_ok;
  return {
    physical,
    digital,
    fused,
    nase,
    mode,
    fail_risk_threshold: USSE_FAIL_RISK,
    score: round6(1 - fused.failure_risk),
    passed,
    error: null,
  };
}

export function usseModeFromRun(mode: RunMode): "physical" | "digital" | "unified" {
  if (mode === "physical" || mode === "digital" || mode === "unified") return mode;
  return "unified";
}
