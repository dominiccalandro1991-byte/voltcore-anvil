import { ANOMALY_MZ, ANOMALY_Z, BEAM_SF_MIN, G, INGEST_BUF, JACCARD_OVERLAP } from "./constants.ts";
import { fnv1aHex, jaccard, sha256Hex, tokenize } from "./hash.ts";
import { MAP_B } from "./registry.ts";

export type LabResult = {
  slug: string;
  ok: boolean;
  elapsedMs: number;
  output: Record<string, unknown>;
};

function kindOf(text: string): "json" | "jsonl" | "csv" | "text" {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  const lines = t.split(/\r?\n/).filter(Boolean);
  const jsonLines = lines.filter((l) => {
    try {
      JSON.parse(l);
      return true;
    } catch {
      return false;
    }
  });
  if (jsonLines.length >= 2 && !t.startsWith("[")) return "jsonl";
  const comma = lines.filter((l) => l.includes(","));
  if (comma.length >= 2) return "csv";
  return "text";
}

export function eng01Ingest(text: string, filename = "paste"): LabResult {
  const t0 = Date.now();
  const kind = kindOf(text);
  const records: Record<string, unknown>[] = [];
  let truncated = false;
  const push = (rec: Record<string, unknown>) => {
    if (records.length >= INGEST_BUF) {
      truncated = true;
      return;
    }
    records.push(rec);
  };
  const routeOf = (rec: Record<string, unknown>, line: string, idx: number) => {
    if (rec.forceReplay || rec.replay || rec._route === "replay") return "/v1/replay";
    if (typeof rec._route === "string" && rec._route.startsWith("/v1/")) return rec._route;
    if (["ts", "timestamp", "time", "t"].some((k) => k in rec)) return "/v1/stream";
    if (idx > 10) return "/v1/batch";
    return "/v1/ingest";
  };
  try {
    if (kind === "json") {
      const parsed = JSON.parse(text) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach((row, i) => {
        const rec = (row && typeof row === "object" ? row : { value: row }) as Record<string, unknown>;
        const line = JSON.stringify(rec);
        const shard = `s-${parseInt(fnv1aHex(line).slice(0, 2), 16) % 8}`;
        push({
          id: `${i}`,
          line,
          route: routeOf(rec, line, arr.length),
          bytes: line.length,
          ok: true,
          shard,
          kind,
          parsed: rec,
        });
      });
    } else {
      text.split(/\r?\n/).forEach((line, i) => {
        if (!line.trim()) return;
        let parsed: Record<string, unknown> = { raw: line };
        let ok = true;
        let error: string | undefined;
        try {
          if (kind === "jsonl") parsed = JSON.parse(line) as Record<string, unknown>;
        } catch (e) {
          ok = false;
          error = e instanceof Error ? e.message : "parse";
        }
        const shard = `s-${parseInt(fnv1aHex(line).slice(0, 2), 16) % 8}`;
        push({
          id: `${i}`,
          line,
          route: ok ? routeOf(parsed, line, i) : "/v1/ingest",
          bytes: line.length,
          ok,
          error,
          shard,
          kind,
          parsed,
        });
      });
    }
  } catch {
    push({
      id: "0",
      line: text.slice(0, 200),
      route: "/v1/ingest",
      bytes: text.length,
      ok: false,
      error: "parse",
      shard: "s-0",
      kind,
      parsed: null,
    });
  }
  const routes: Record<string, number> = {};
  for (const r of records) {
    const rt = String(r.route);
    routes[rt] = (routes[rt] ?? 0) + 1;
  }
  return {
    slug: "ingestion-core",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: {
      kind,
      records: records.length,
      bytes: new TextEncoder().encode(text).length,
      elapsedMs: Date.now() - t0,
      truncated,
      routes,
      sample: records.slice(0, 8),
      filename,
    },
  };
}

export function eng02Indexer(text: string): LabResult {
  const t0 = Date.now();
  const docs = text.split(/\n---+\n/);
  const df = new Map<string, number>();
  const tfSum = new Map<string, number>();
  const ngram = new Map<string, 1 | 2>();
  let tokens = 0;
  for (const doc of docs) {
    const toks = tokenize(doc);
    tokens += toks.length;
    const seen = new Set<string>();
    const tf = new Map<string, number>();
    for (let i = 0; i < toks.length; i += 1) {
      const u = toks[i]!;
      tf.set(u, (tf.get(u) ?? 0) + 1);
      ngram.set(u, 1);
      if (i + 1 < toks.length) {
        const bi = `${u} ${toks[i + 1]}`;
        tf.set(bi, (tf.get(bi) ?? 0) + 1);
        ngram.set(bi, 2);
      }
    }
    for (const [term, c] of tf) {
      tfSum.set(term, (tfSum.get(term) ?? 0) + c);
      if (!seen.has(term)) {
        seen.add(term);
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
  }
  const n = docs.length;
  const terms = [...tfSum.entries()]
    .map(([term, tf]) => {
      const d = df.get(term) ?? 1;
      const tfidf = tf * (Math.log((n + 1) / (d + 1)) + 1);
      return { term, tf, df: d, tfidf, ngram: ngram.get(term) ?? 1 };
    })
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 40);
  return {
    slug: "heuristic-indexer",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { docs: n, tokens, terms },
  };
}

export async function eng03PriorArt(
  claim: string,
  corpus: { title: string; body: string }[],
): Promise<LabResult> {
  const t0 = Date.now();
  const claimTok = tokenize(claim);
  const claimHash = await sha256Hex(claim);
  const hits = [];
  let max = 0;
  let exact = false;
  for (let i = 0; i < corpus.length; i += 1) {
    const c = corpus[i]!;
    const body = `${c.title}\n${c.body}`;
    const jac = jaccard(claimTok, tokenize(body));
    const h = await sha256Hex(c.body);
    const isExact = h === claimHash;
    if (isExact) exact = true;
    if (jac > max) max = jac;
    hits.push({
      index: i,
      title: c.title,
      jaccard: jac,
      exact: isExact,
      preview: c.body.slice(0, 80),
    });
  }
  const verdict = exact ? "exact" : max >= JACCARD_OVERLAP ? "overlap" : "clear";
  return {
    slug: "prior-art-validator",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { hits, max, verdict },
  };
}

export function eng04Anomaly(seriesText: string): LabResult {
  const t0 = Date.now();
  let nums: number[] = [];
  try {
    const p = JSON.parse(seriesText) as unknown;
    if (Array.isArray(p)) nums = p.map(Number).filter(Number.isFinite);
    else if (p && typeof p === "object") {
      nums = Object.values(p as Record<string, unknown>)
        .map(Number)
        .filter(Number.isFinite);
    }
  } catch {
    nums = seriesText
      .split(/[\s,;]+/)
      .map(Number)
      .filter(Number.isFinite);
  }
  const n = nums.length;
  const mean = n ? nums.reduce((s, x) => s + x, 0) / n : 0;
  const variance =
    n > 1 ? nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const sorted = [...nums].sort((a, b) => a - b);
  const median = n
    ? n % 2
      ? sorted[(n - 1) / 2]!
      : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
    : 0;
  const devs = nums.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  const mad = n
    ? n % 2
      ? devs[(n - 1) / 2]!
      : (devs[n / 2 - 1]! + devs[n / 2]!) / 2
    : 0;
  const points = nums.map((x, i) => {
    const z = std > 0 ? (x - mean) / std : 0;
    const mz = mad > 0 ? (0.6745 * (x - median)) / mad : 0;
    const flag = Math.abs(z) >= ANOMALY_Z || Math.abs(mz) >= ANOMALY_MZ;
    return { i, x, z, mz, flag };
  });
  return {
    slug: "anomaly-detector",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: {
      n,
      mean,
      std,
      median,
      mad,
      points,
      flagged: points.filter((p) => p.flag).length,
    },
  };
}

type Playbook = { id: string; label: string; keys: string[]; sev?: string[]; patterns?: RegExp[] };

const PLAYBOOKS: Playbook[] = [
  {
    id: "pb-incident",
    label: "page on-call",
    keys: ["incident", "severity", "service"],
    sev: ["sev1", "sev2", "critical", "p0", "p1"],
  },
  {
    id: "pb-deploy",
    label: "halt pipeline",
    keys: ["deploy", "release", "sha"],
    patterns: [/rollback/i, /failed deploy/i, /health check/i],
  },
  { id: "pb-ratelimit", label: "trip KeyHarbor", keys: ["429", "rate", "quota"] },
  { id: "pb-schema", label: "ScopeShield", keys: ["schema", "field", "type"] },
  { id: "pb-auth", label: "rotate key", keys: ["401", "403", "auth", "token"] },
  { id: "pb-default", label: "ack · CausalRail", keys: [] },
];

export function eng05Aegis(text: string): LabResult {
  const t0 = Date.now();
  const lower = text.toLowerCase();
  const scores = PLAYBOOKS.map((pb) => {
    let score = pb.id === "pb-default" ? 1 : 0;
    for (const k of pb.keys) if (lower.includes(k)) score += 2;
    if (pb.sev) for (const s of pb.sev) if (lower.includes(s)) score += 4;
    if (pb.patterns) for (const re of pb.patterns) if (re.test(text)) score += 5;
    return { id: pb.id, label: pb.label, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return {
    slug: "aegis-router",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { winner_playbook: scores[0], playbook_scores: scores },
  };
}

export function eng06Kinematic(m: number, a: number, t: number, v0: number): LabResult {
  const t0 = Date.now();
  const F = m * a;
  const v = v0 + a * t;
  const s = v0 * t + 0.5 * a * t * t;
  const impulse = F * t;
  const KE = 0.5 * m * v * v;
  const p = m * v;
  const work = F * s;
  const gLoad = a / G;
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  return {
    slug: "kinematic-load",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: {
      F: r4(F),
      v: r4(v),
      s: r4(s),
      impulse: r4(impulse),
      KE: r4(KE),
      p: r4(p),
      work: r4(work),
      gLoad: r4(gLoad),
    },
  };
}

const MATERIALS: Record<string, { muS: number; muK: number; wet: number }> = {
  rubber: { muS: 0.9, muK: 0.7, wet: 0.55 },
  steel: { muS: 0.74, muK: 0.57, wet: 0.16 },
  concrete: { muS: 0.8, muK: 0.65, wet: 0.45 },
  ice: { muS: 0.1, muK: 0.03, wet: 0.03 },
  mud: { muS: 0.4, muK: 0.2, wet: 0.15 },
  wood: { muS: 0.5, muK: 0.3, wet: 0.2 },
};

export function eng07Terrain(
  material: string,
  mass: number,
  slopeDeg: number,
  wet: boolean,
): LabResult {
  const t0 = Date.now();
  const mat = MATERIALS[material] ?? MATERIALS.rubber!;
  const muS = wet ? mat.wet : mat.muS;
  const theta = (slopeDeg * Math.PI) / 180;
  const N = mass * G * Math.cos(theta);
  const Fdown = mass * G * Math.sin(theta);
  const Fmax = muS * N;
  const slips = Math.abs(Fdown) > Fmax;
  const crr = wet ? 0.02 : 0.012;
  const roll = crr * N;
  const gradePct = 100 * Math.tan(theta);
  return {
    slug: "terrain-analyzer",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { muS, N, Fdown, Fmax, slips, roll, gradePct },
  };
}

export function eng08TorqueThermal(opts: {
  rpm: number;
  torque: number;
  eta: number;
  minutes: number;
  mass: number;
  cp: number;
  hA: number;
  TAmb: number;
  tLimit: number;
}): LabResult {
  const t0 = Date.now();
  const omega = (opts.rpm * 2 * Math.PI) / 60;
  const Pin = opts.torque * omega;
  const eta = Math.min(0.99, Math.max(0.05, opts.eta));
  const heat = Pin * (1 - eta);
  const steps = Math.min(3600, Math.max(1, Math.round(opts.minutes * 60)));
  const C = Math.max(1, opts.mass * opts.cp);
  let T = opts.TAmb;
  let tripAt: number | null = null;
  const series: { t: number; T: number }[] = [];
  const stride = Math.max(1, Math.floor(steps / 60));
  for (let t = 1; t <= steps; t += 1) {
    const dT = (heat - opts.hA * (T - opts.TAmb)) / C;
    T += dT;
    if (tripAt === null && T >= opts.tLimit) tripAt = t;
    if (t % stride === 0 || t === steps) series.push({ t, T });
  }
  const derate = T > opts.tLimit ? 1 - (T - opts.tLimit) / 40 : 1;
  return {
    slug: "torque-thermal",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { omega, Pin, heat, T, tripAt, derate: Math.max(0, derate), series },
  };
}

const STRUCT: Record<string, { E: number; fy: number }> = {
  steel: { E: 200e9, fy: 250e6 },
  aluminum: { E: 69e9, fy: 276e6 },
  timber: { E: 12e9, fy: 40e6 },
  titanium: { E: 116e9, fy: 880e6 },
};

export function eng09Structural(
  shape: "rect" | "circ",
  b: number,
  h: number,
  P: number,
  L: number,
  material: string,
): LabResult {
  const t0 = Date.now();
  const mat = STRUCT[material] ?? STRUCT.steel!;
  const I = shape === "rect" ? (b * h ** 3) / 12 : (Math.PI * h ** 4) / 64;
  const y = h / 2;
  const M = (P * L) / 4;
  const sigma = (M * y) / I;
  const delta = (P * L ** 3) / (48 * mat.E * I);
  const SF = sigma === 0 ? Infinity : mat.fy / sigma;
  return {
    slug: "structural-validator",
    ok: SF >= BEAM_SF_MIN,
    elapsedMs: Date.now() - t0,
    output: { I, y, M, sigma, delta, SF, pass: SF >= BEAM_SF_MIN },
  };
}

export function eng10Market(csv: string): LabResult {
  const t0 = Date.now();
  const rows = csv
    .split(/\n/)
    .map((l) => l.split(",").map((s) => s.trim()))
    .filter((r) => r.length >= 4 && r[0] !== "name");
  const items = rows.map((r) => ({
    name: r[0]!,
    price: Number(r[1]),
    users: Number(r[2]),
    growth: Number(r[3]),
  }));
  const total = items.reduce((s, i) => s + i.users, 0) || 1;
  const maxP = Math.max(...items.map((i) => i.price), 1);
  let hhi = 0;
  const scored = items.map((i) => {
    const share = i.users / total;
    hhi += 10000 * share * share;
    const threat =
      100 * (0.5 * share + 0.3 * Math.max(0, i.growth) / 100 + 0.2 * (1 - i.price / maxP));
    return { ...i, share, threat };
  });
  const conc = hhi >= 2500 ? "highly" : hhi >= 1500 ? "moderate" : "unconcentrated";
  return {
    slug: "market-indexer",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { items: scored, HHI: hhi, conc },
  };
}

export function eng12Ast(src: string): LabResult {
  const t0 = Date.now();
  const kids: { type: string; start: number; end: number }[] = [];
  const re =
    /\b(function|const|let|var|class|return|if|for|while|import|export)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    kids.push({ type: m[1]!, start: m.index, end: m.index + m[0].length });
  }
  return {
    slug: "ast-parser",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { type: "Program", start: 0, end: src.length, kids: kids.slice(0, 80) },
  };
}

export function eng13Syntax(src: string): LabResult {
  const t0 = Date.now();
  const findings: { rule: string; sev: string; preview: string }[] = [];
  if (/\breturn\b/.test(src)) findings.push({ rule: "no-return", sev: "info", preview: "return" });
  if (/==[^=]/.test(src) || /!=[^=]/.test(src))
    findings.push({ rule: "eqeqeq", sev: "warn", preview: "==/!=" });
  if (/\bdebugger\b/.test(src)) findings.push({ rule: "no-debugger", sev: "err", preview: "debugger" });
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(src))
    findings.push({ rule: "no-empty-catch", sev: "warn", preview: "empty catch" });
  if (/\bconsole\./.test(src)) findings.push({ rule: "no-console", sev: "info", preview: "console" });
  return {
    slug: "syntax-logic-validator",
    ok: !findings.some((f) => f.sev === "err"),
    elapsedMs: Date.now() - t0,
    output: {
      findings,
      counts: {
        fn: (src.match(/\bfunction\b/g) ?? []).length,
        ident: tokenize(src).length,
        eqeq: (src.match(/==/g) ?? []).length,
        debugger: (src.match(/\bdebugger\b/g) ?? []).length,
        console: (src.match(/\bconsole\./g) ?? []).length,
      },
    },
  };
}

function lcsDiff(a: string[], b: string[]): string {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i += 1)
    for (let j = 1; j <= m; j += 1)
      dp[i]![j] = a[i - 1] === b[j - 1] ? (dp[i - 1]![j - 1]! + 1) as number : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  const out: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push(" " + a[i - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push("-" + a[i - 1]);
      i -= 1;
    } else {
      out.push("+" + b[j - 1]);
      j -= 1;
    }
  }
  while (i > 0) {
    out.push("-" + a[--i]);
  }
  while (j > 0) {
    out.push("+" + b[--j]);
  }
  return out.reverse().join("\n");
}

export function eng14Refactor(src: string): LabResult {
  const t0 = Date.now();
  let next = src
    .replace(/([^!=])==([^=])/g, "$1===$2")
    .replace(/([^!=])!=([^=])/g, "$1!==$2")
    .replace(/\bvar\b/g, "let")
    .replace(/^\s*debugger;?\s*$/gm, "")
    .replace(/^\s*console\.(log|debug|info)\(.*\);?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  const diff = lcsDiff(src.split("\n"), next.split("\n"));
  return {
    slug: "refactor-engine",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { rewritten: next, diff },
  };
}

export function eng18Commit(before: string, after: string): LabResult {
  const t0 = Date.now();
  const a = before.split("\n");
  const b = after.split("\n");
  const diff = lcsDiff(a, b);
  const blob = diff;
  let type = "chore";
  if (/test/i.test(blob)) type = "test";
  else if (/fix|bug/i.test(blob)) type = "fix";
  else if (/feat|add/i.test(blob)) type = "feat";
  else if (/refactor/i.test(blob)) type = "refactor";
  else if (/style/i.test(blob)) type = "style";
  else if (/doc/i.test(blob)) type = "docs";
  return {
    slug: "commit-orchestrator",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { type, added: b.length, deleted: a.length, diff: diff.slice(0, 4000) },
  };
}

export function eng19Viewport(html: string): LabResult {
  const t0 = Date.now();
  const checks = [
    { name: "viewport meta", pass: /<meta[^>]+viewport/i.test(html) },
    { name: "width=device-width", pass: /width\s*=\s*device-width/i.test(html) },
    {
      name: "no inline min-height < 44px",
      pass: !/(button|a|input)[^>]+min-height\s*:\s*([0-3]?\d)px/i.test(html),
    },
    { name: "no input font-size < 16px", pass: !/input[^>]+font-size\s*:\s*([0-9]|1[0-5])px/i.test(html) },
    { name: "no overflow-x:scroll", pass: !/overflow-x\s*:\s*scroll/i.test(html) },
  ];
  const score = 100 * (checks.filter((c) => c.pass).length / checks.length);
  return {
    slug: "mobile-viewport-attestation",
    ok: score === 100,
    elapsedMs: Date.now() - t0,
    output: { checks, score, reference: "390×844" },
  };
}

export function eng20Compile(src: string): LabResult {
  const t0 = Date.now();
  const findings: { sev: string; msg: string }[] = [];
  if (/process\.env/.test(src) && !/import\.meta\.env/.test(src))
    findings.push({ sev: "warn", msg: "process.env without import.meta.env" });
  if (/XAI_API_KEY|SECRET|PRIVATE_KEY/.test(src))
    findings.push({ sev: "err", msg: "secret identifier in source" });
  const compiled = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\bdebugger;?/g, "")
    .replace(/console\.(log|debug|info)\([^;]*\);?/g, "")
    .replace(/\n{3,}/g, "\n\n");
  return {
    slug: "production-build-compiler",
    ok: !findings.some((f) => f.sev === "err"),
    elapsedMs: Date.now() - t0,
    output: {
      originalBytes: src.length,
      compiledBytes: compiled.length,
      saved: src.length - compiled.length,
      findings,
      compiled: compiled.slice(0, 4000),
    },
  };
}

export function eng21CausalRail(traces: string[]): LabResult {
  const t0 = Date.now();
  const normalize = (s: string) =>
    s
      .replace(/\b[0-9a-f]{8,}\b/gi, "<HEX>")
      .replace(/\b[0-9a-f]{32,}\b/gi, "<HASH>")
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<IP>")
      .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, "<TIME>")
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<DATE>")
      .replace(/\d+/g, "<N>")
      .replace(/\s+/g, " ")
      .trim();
  const classify = (s: string) => {
    if (/null|undefined/.test(s)) return "NULL-DEREF";
    if (/timeout|ETIMEDOUT|abort/i.test(s)) return "NET-TIMEOUT";
    if (/typeerror|cannot read/i.test(s)) return "TYPE-ERROR";
    if (/oom|heap|memory/i.test(s)) return "MEM-PRESSURE";
    if (/401|403|unauth|token/i.test(s)) return "AUTH";
    if (/fail(ed|ure)|assert/i.test(s)) return "TEST-FAIL";
    if (/syntax/i.test(s)) return "SYNTAX";
    return "UNCLASSIFIED";
  };
  const map = new Map<string, { signature: string; cls: string; freq: number; shaPrefix: string }>();
  for (const t of traces) {
    const signature = normalize(t);
    const key = fnv1aHex(signature);
    const cur = map.get(key);
    if (cur) cur.freq += 1;
    else
      map.set(key, {
        signature,
        cls: classify(t.toLowerCase()),
        freq: 1,
        shaPrefix: "",
      });
  }
  const clusters = [...map.values()].sort((a, b) => b.freq - a.freq);
  return {
    slug: "causalrail",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: {
      clusters,
      runs: traces.length,
      saved: traces.length - clusters.length,
    },
  };
}

const RUNBOOKS = [
  { id: "rb-db", title: "Database saturation", body: "connection pool timeout lock wait vacuum replica lag" },
  { id: "rb-null", title: "Null dereference", body: "cannot read property of undefined optional chaining guard" },
  { id: "rb-429", title: "Rate limit 429", body: "quota token bucket keyharbor retry-after backoff" },
  { id: "rb-deploy", title: "Failed deploy", body: "health check rollback sha pipeline halt" },
  { id: "rb-oom", title: "Memory pressure", body: "heap oom usedjssheapsize leak chunk release" },
];

export function eng23Dojo(incident: string, extra = ""): LabResult {
  const t0 = Date.now();
  const corpus = [
    ...RUNBOOKS,
    ...extra.split(/\n---\n/).filter(Boolean).map((b, i) => ({
      id: `extra-${i}`,
      title: b.split("\n")[0] ?? "extra",
      body: b,
    })),
  ];
  const incTok = tokenize(incident);
  const hits = corpus
    .map((rb) => {
      const toks = tokenize(`${rb.title} ${rb.body}`);
      const score = jaccard(incTok, toks);
      const overlap = incTok.filter((t) => toks.includes(t)).slice(0, 8);
      return { id: rb.id, title: rb.title, score, overlap };
    })
    .sort((a, b) => b.score - a.score);
  return {
    slug: "incidentdojo",
    ok: true,
    elapsedMs: Date.now() - t0,
    output: { runbook_hits: hits },
  };
}

const SECRET_VAL =
  /\b(AKIA[0-9A-Z]{16}|sk-|rk-|ghp_|xai-|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|BEGIN [A-Z ]+PRIVATE KEY)/;

export function eng24ScopeShield(dotenv: string, schemaKeys: string[] = []): LabResult {
  const t0 = Date.now();
  const findings: { key: string; sev: string; redacted: string }[] = [];
  const present = new Set<string>();
  for (const line of dotenv.split(/\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    const value = m[2]!.replace(/^["']|["']$/g, "");
    present.add(key);
    const looksKey = /key|secret|token|password|private/i.test(key);
    const looksSecret =
      looksKey &&
      value.length > 8 &&
      !/\$\{/.test(value) &&
      !/changeme|your_key_here/i.test(value);
    const regexHit = SECRET_VAL.test(value);
    if (looksSecret || regexHit) {
      const redacted = `${value.slice(0, 3)}…${value.slice(-2)} len=${value.length}`;
      findings.push({ key, sev: "err", redacted });
    }
  }
  for (const k of schemaKeys) {
    if (!present.has(k)) findings.push({ key: k, sev: "warn", redacted: "missing" });
  }
  return {
    slug: "scopeshield",
    ok: findings.filter((f) => f.sev === "err").length === 0,
    elapsedMs: Date.now() - t0,
    output: { findings, leaked: findings.filter((f) => f.sev === "err").length },
  };
}

export function runLab(slug: string, input: string): Promise<LabResult> | LabResult {
  switch (slug) {
    case "ingestion-core":
      return eng01Ingest(input);
    case "heuristic-indexer":
      return eng02Indexer(input);
    case "prior-art-validator":
      return eng03PriorArt(input, [
        { title: "USSE stress.py", body: "torque lever utilization digital pressure fusion 0.85" },
        { title: "k6 load test", body: "virtual users rps latency p99" },
      ]);
    case "anomaly-detector":
      return eng04Anomaly(input);
    case "aegis-router":
      return eng05Aegis(input);
    case "kinematic-load":
      return eng06Kinematic(10, 2, 3, 0);
    case "terrain-analyzer":
      return eng07Terrain("rubber", 400, 12, false);
    case "torque-thermal":
      return eng08TorqueThermal({
        rpm: 3000,
        torque: 12,
        eta: 0.85,
        minutes: 2,
        mass: 4,
        cp: 900,
        hA: 8,
        TAmb: 25,
        tLimit: 90,
      });
    case "structural-validator":
      return eng09Structural("rect", 0.05, 0.1, 4000, 2, "steel");
    case "market-indexer":
      return eng10Market(input || "name,price,users,growth\nalpha,10,1000,20\nbeta,8,400,5");
    case "ast-parser":
      return eng12Ast(input);
    case "syntax-logic-validator":
      return eng13Syntax(input);
    case "refactor-engine":
      return eng14Refactor(input);
    case "commit-orchestrator":
      return eng18Commit("old", input);
    case "mobile-viewport-attestation":
      return eng19Viewport(input);
    case "production-build-compiler":
      return eng20Compile(input);
    case "causalrail":
      return eng21CausalRail(input.split(/\n/).filter(Boolean));
    case "incidentdojo":
      return eng23Dojo(input);
    case "scopeshield":
      return eng24ScopeShield(input);
    default: {
      const meta = MAP_B.find((e) => e.slug === slug);
      return {
        slug,
        ok: true,
        elapsedMs: 0,
        output: {
          note: meta?.usesAi
            ? "AI engine — invoke from Console (user-initiated, capped)."
            : meta?.role ?? "instrument",
        },
      };
    }
  }
}
