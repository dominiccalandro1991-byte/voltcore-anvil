import { nowMs, tokenize, jaccard, sha256Hex } from "./hash.ts";
import { parseSpec, runUsse, emptyPayload, USSE_INTENT } from "./usse.ts";
import { MAP_A } from "./registry.ts";
import type { Json } from "../types.ts";

export const HEAL_DENIED =
  /\/heal\b|autonomous[_\s-]?trunk|trunk[_\s-]?write/i;

export function isHealDenied(s: string): boolean {
  return HEAL_DENIED.test(s);
}

export type IsolateKind = "usse" | "json" | "math" | "tokens";

export type IsolateReport = {
  ok: boolean;
  kind: IsolateKind;
  elapsed_ms: number;
  tokens: string[];
  token_count: number;
  overlap: number;
  output: Json;
  s_attest: string;
  error?: string;
};

/** Arithmetic only: digits, + - * / ( ) . whitespace. No identifiers, no eval. */
export function evalArithmetic(expr: string): number | null {
  const src = expr.replace(/\s+/g, "");
  if (!src || src.length > 120) return null;
  if (!/^[0-9+\-*/().]+$/.test(src)) return null;
  let i = 0;
  const peek = () => src[i] ?? "";
  const eat = () => src[i++] ?? "";
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const r = parseFactor();
      if (op === "/") {
        if (r === 0) throw new Error("div0");
        v = v / r;
      } else v *= r;
    }
    return v;
  }
  function parseFactor(): number {
    if (peek() === "+") {
      eat();
      return parseFactor();
    }
    if (peek() === "-") {
      eat();
      return -parseFactor();
    }
    if (peek() === "(") {
      eat();
      const v = parseExpr();
      if (eat() !== ")") throw new Error("paren");
      return v;
    }
    let s = "";
    while (/[0-9.]/.test(peek())) s += eat();
    if (!s) throw new Error("num");
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error("nan");
    return n;
  }
  try {
    const v = parseExpr();
    if (i !== src.length) return null;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export async function runIsolate(source: string): Promise<IsolateReport> {
  const t0 = nowMs();
  const text = source.slice(0, 8000);
  if (isHealDenied(text)) {
    return {
      ok: false,
      kind: "tokens",
      elapsed_ms: nowMs() - t0,
      tokens: [],
      token_count: 0,
      overlap: 0,
      output: { denied: "heal/trunk" },
      s_attest: "",
      error: "heal/trunk denied",
    };
  }
  const tokens = tokenize(text);
  const roles = MAP_A.flatMap((e) => tokenize(`${e.id} ${e.role}`));
  const overlap = jaccard(tokens, roles);
  const nonce =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : "anvil-isolate";
  const trimmed = text.trim();

  if (USSE_INTENT.test(trimmed) || /lb|lever|agent/i.test(trimmed)) {
    const payload = parseSpec(trimmed, "isolate");
    payload.mode = "unified";
    payload.attestation_timestamp = Date.now() / 1000;
    if (payload.load_lb === 0) {
      payload.load_lb = 400;
      payload.mass_kg = 0;
    }
    const report = runUsse(emptyPayload(payload));
    const s_attest = await sha256Hex(
      `${nonce}|${report.fused.failure_risk.toFixed(12)}`,
    );
    return {
      ok: report.passed,
      kind: "usse",
      elapsed_ms: nowMs() - t0,
      tokens,
      token_count: tokens.length,
      overlap,
      output: {
        passed: report.passed,
        score: report.score,
        failure_risk: report.fused.failure_risk,
        mass_kg: report.physical.mass_kg,
        utilization: report.physical.utilization,
        digital_pressure: report.digital.digital_pressure,
        error: report.error ?? null,
      },
      s_attest,
      error: report.error ?? undefined,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Json;
    const s_attest = await sha256Hex(`${nonce}|json|${tokens.length}`);
    return {
      ok: true,
      kind: "json",
      elapsed_ms: nowMs() - t0,
      tokens,
      token_count: tokens.length,
      overlap,
      output: parsed,
      s_attest,
    };
  } catch {
    /* not json */
  }

  const math = evalArithmetic(trimmed);
  if (math != null) {
    const s_attest = await sha256Hex(`${nonce}|math|${math.toFixed(12)}`);
    return {
      ok: true,
      kind: "math",
      elapsed_ms: nowMs() - t0,
      tokens,
      token_count: tokens.length,
      overlap,
      output: { value: math },
      s_attest,
    };
  }

  const s_attest = await sha256Hex(`${nonce}|tok|${tokens.join(",")}`);
  return {
    ok: true,
    kind: "tokens",
    elapsed_ms: nowMs() - t0,
    tokens,
    token_count: tokens.length,
    overlap,
    output: { tokens: tokens.slice(0, 40), overlap },
    s_attest,
  };
}
