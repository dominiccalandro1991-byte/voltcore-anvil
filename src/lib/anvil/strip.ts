import { FORBID } from "./fleet.ts";
import type { Anomaly, IngestedBundle, StripReport, VirtualFile } from "./types.ts";

const SECRET = /(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|service_role|SUPABASE_SERVICE_ROLE|BEGIN OPENSSH PRIVATE KEY)/;
const EVAL = /\beval\s*\(|new\s+Function\s*\(/;
const INTERVAL = /setInterval\s*\(/;
const CLEAR_INTERVAL = /clearInterval\s*\(/;
const LISTEN = /addEventListener\s*\(/;
const UNLISTEN = /removeEventListener\s*\(/;
const GROW = /\.push\s*\(|\s*\+=\s*[^=]/;
const LOOP = /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/;
const SHARED = /\blet\s+(state|cache|counter|acc|buf)\b|\bvar\s+(state|cache|counter)/;
const AWAIT_MISS = /^(?!.*await).*fetch\s*\(/m;

function lineOf(src: string, idx: number): number {
  let n = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

function scanFile(file: VirtualFile): Anomaly[] {
  const hits: Anomaly[] = [];
  const src = file.content;
  const push = (kind: Anomaly["kind"], re: RegExp, detail: string, stripped = false) => {
    const m = src.match(re);
    if (!m || m.index == null) return;
    hits.push({ kind, path: file.path, line: lineOf(src, m.index), detail, stripped });
  };
  if (FORBID.test(file.path)) {
    hits.push({
      kind: "forbidden_path",
      path: file.path,
      line: 1,
      detail: "Path matches mesh FORBID contract",
      stripped: true,
    });
    return hits;
  }
  push("secret", SECRET, "Credential material in tree", true);
  push("eval", EVAL, "Dynamic eval / Function constructor");
  if (INTERVAL.test(src) && !CLEAR_INTERVAL.test(src)) {
    push("interval_leak", INTERVAL, "setInterval without clearInterval");
  }
  if (LISTEN.test(src) && !UNLISTEN.test(src)) {
    push("listener_leak", LISTEN, "addEventListener without removeEventListener");
  }
  if (LOOP.test(src) && GROW.test(src)) {
    push("unbounded_growth", LOOP, "Unbounded loop with growing buffer");
  }
  push("race_shared", SHARED, "Module-scope mutable shared cell");
  if (/async|fetch|Promise/.test(src)) push("missing_await", AWAIT_MISS, "Async edge without await/then pairing");
  return hits;
}

/** O(n) over files. Drops FORBID + secret-bearing paths. */
export function stripBundle(bundle: IngestedBundle): StripReport {
  const kept: VirtualFile[] = [];
  const removed: { path: string; reason: string }[] = [];
  const anomalies: Anomaly[] = [];
  let bytesOut = 0;
  for (const file of bundle.files) {
    const hits = scanFile(file);
    anomalies.push(...hits);
    const drop = hits.find((h) => h.stripped);
    if (drop) {
      removed.push({ path: file.path, reason: drop.kind });
      continue;
    }
    kept.push(file);
    bytesOut += file.size;
  }
  return { kept, removed, anomalies, bytesIn: bundle.bytes, bytesOut };
}
