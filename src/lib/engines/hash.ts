/** FNV-1a 32-bit. Offset 2166136261, prime 16777619, hex pad 8. */
export function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fnv1aHex(input: string): string {
  return fnv1a(input).toString(16).padStart(8, "0");
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 unavailable");
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function histogramBin(ms: number): number {
  const edges = [20, 50, 100, 200, 500, 1000, 2000, 5000];
  for (let i = 0; i < edges.length; i += 1) {
    if (ms < edges[i]!) return i;
  }
  return edges.length;
}

export function emptyHistogram(): number[] {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "it",
  "as", "at", "by", "be", "this", "that", "with", "from", "are", "was", "were",
]);

export function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[0]!.toLowerCase();
    if (t.length > 1 && !STOP.has(t)) out.push(t);
  }
  return out;
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
