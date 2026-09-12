import { ENGINE_COUNT, UNIFORM_WEIGHT } from "./constants.ts";
import { clamp, sha256Hex } from "./hash.ts";
import { MAP_A } from "./registry.ts";

export type PhiVector = {
  k: number;
  engine_id: string;
  omega: number;
  phi: number;
  description: string;
};

async function stableUnitFloat(key: string): Promise<number> {
  const hex = (await sha256Hex(key)).slice(0, 12);
  const n = Number.parseInt(hex, 16);
  return ((n % 1e6) + 1) / (1e6 + 1);
}

export async function computePhiVector(
  now = Date.now() / 1000,
): Promise<{
  vectors: PhiVector[];
  weighted_sum: number;
  canonical: string;
  t: number;
}> {
  const bucket = Math.floor(now / 60);
  const engines = [...MAP_A];
  while (engines.length < ENGINE_COUNT) {
    const k = engines.length + 1;
    engines.push({
      k,
      id: `pad-${k}`,
      role: "padding",
    });
  }
  const vectors: PhiVector[] = [];
  for (let i = 0; i < ENGINE_COUNT; i += 1) {
    const e = engines[i]!;
    const base = await stableUnitFloat(`${e.id}|${e.role}|${i}`);
    const drift = await stableUnitFloat(`${e.id}|${bucket}`);
    const structural = Math.min(1, ((e.role.length % 97) / 97) + 0.01);
    const phi = clamp(0.55 * base + 0.3 * drift + 0.15 * structural, 1e-6, 1);
    vectors.push({
      k: e.k,
      engine_id: e.id,
      omega: UNIFORM_WEIGHT,
      phi,
      description: e.role,
    });
  }
  const weighted_sum = vectors.reduce((s, v) => s + v.omega * v.phi, 0);
  const joined = vectors.map((v) => `${v.engine_id}:${v.phi}`).join(",");
  const canonical = `t=${now.toFixed(6)}|count=${ENGINE_COUNT}|sum=${weighted_sum.toFixed(12)}|${joined}`;
  return { vectors, weighted_sum, canonical, t: now };
}

export async function attest(
  nonce: string,
  weighted: number,
): Promise<string> {
  return sha256Hex(`${nonce}|${weighted.toFixed(12)}`);
}

export async function exportAttestation(nonce?: string): Promise<{
  vectors: PhiVector[];
  weighted_sum: number;
  s_attest: string;
  canonical: string;
  nonce: string;
  t: number;
}> {
  const n =
    nonce ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18));
  const { vectors, weighted_sum, canonical, t } = await computePhiVector();
  const s_attest = await attest(n, weighted_sum);
  return { vectors, weighted_sum, s_attest, canonical, nonce: n, t };
}
