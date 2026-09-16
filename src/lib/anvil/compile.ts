import type { CompileReport, CompiledRoute, DepNode, StripReport, VirtualFile } from "./types.ts";

const IMPORT_RE = /(?:from|import)\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

function classify(file: VirtualFile): CompiledRoute | null {
  const p = file.path;
  const ext = extOf(p);
  if (/(^|\/)api\//.test(p) || /\/routes\/api\//.test(p) || p.includes("server/")) {
    return { path: "/" + p.replace(/^src\/routes/, "").replace(/\.(t|j)sx?$/, ""), kind: "api", file: p, dynamic: true };
  }
  if (/routes\/.*\.(t|j)sx$/.test(p) || /app\/.*page\.(t|j)sx$/.test(p)) {
    const dyn = /\[.+\]|\$/.test(p);
    return {
      path: "/" + p.replace(/^src\/routes\//, "").replace(/\.(t|j)sx$/, "").replace(/index$/, ""),
      kind: "ssr",
      file: p,
      dynamic: dyn,
    };
  }
  if (["html", "css", "svg", "png", "jpg", "webp", "woff2"].includes(ext) || p.startsWith("public/")) {
    return { path: "/" + p.replace(/^public\//, ""), kind: ext === "html" ? "static" : "asset", file: p, dynamic: false };
  }
  if (["ts", "js", "mjs", "tsx", "jsx"].includes(ext)) {
    return { path: "/" + p, kind: "static", file: p, dynamic: false };
  }
  return null;
}

function resolveImport(from: string, spec: string, index: Set<string>): string | null {
  if (spec.startsWith(".") || spec.startsWith("/")) {
    const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    const joined = spec.startsWith("/") ? spec.slice(1) : (dir ? dir + "/" + spec : spec);
    const norm = joined.replace(/\/\.\//g, "/").replace(/[^/]+\/\.\.\//g, "");
    const candidates = [norm, norm + ".ts", norm + ".tsx", norm + ".js", norm + "/index.ts", norm + "/index.js"];
    for (const c of candidates) if (index.has(c)) return c;
    return norm;
  }
  return null;
}

function detectCycles(graph: DepNode[]): string[][] {
  const map = new Map(graph.map((n) => [n.path, n.imports]));
  const cycles: string[][] = [];
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  function dfs(u: string) {
    color.set(u, 1);
    stack.push(u);
    for (const v of map.get(u) || []) {
      if (!map.has(v)) continue;
      const c = color.get(v) ?? 0;
      if (c === 1) {
        const i = stack.indexOf(v);
        if (i >= 0) cycles.push(stack.slice(i).concat(v));
      } else if (c === 0) dfs(v);
    }
    stack.pop();
    color.set(u, 2);
  }
  for (const n of graph) if ((color.get(n.path) ?? 0) === 0) dfs(n.path);
  return cycles.slice(0, 8);
}

function frameworkOf(files: VirtualFile[]): CompileReport["framework"] {
  const names = files.map((f) => f.path);
  if (names.some((p) => p.includes("@tanstack") || p === "src/router.tsx" || p.includes("tanstack"))) {
    return "tanstack-start";
  }
  const pkg = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  if (pkg?.content.includes("@tanstack/react-start")) return "tanstack-start";
  if (pkg?.content.includes("next")) return "next";
  if (names.some((p) => p === "vite.config.ts" || p === "vite.config.js")) return "vite";
  if (names.some((p) => p.endsWith(".html"))) return "html";
  return "unknown";
}

function parseDeps(files: VirtualFile[]): string[] {
  const pkg = files.find((f) => /(^|\/)package\.json$/.test(f.path));
  if (!pkg) return [];
  try {
    const json = JSON.parse(pkg.content) as { dependencies?: Record<string, string> };
    return Object.keys(json.dependencies || {});
  } catch {
    return [];
  }
}

/** O(n + e) over files and import edges. */
export function compileBundle(strip: StripReport): CompileReport {
  const files = strip.kept;
  const index = new Set(files.map((f) => f.path));
  const routes: CompiledRoute[] = [];
  const graph: DepNode[] = [];
  let complexity = 0;
  for (const file of files) {
    const route = classify(file);
    if (route) routes.push(route);
    const imports: string[] = [];
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(file.content))) {
      const spec = m[1] || m[2];
      if (!spec) continue;
      const resolved = resolveImport(file.path, spec, index);
      if (resolved) imports.push(resolved);
    }
    graph.push({ path: file.path, imports });
    complexity += 1 + Math.min(12, Math.floor(file.size / 400)) + imports.length;
  }
  const declared = parseDeps(files);
  const usedBare = new Set<string>();
  for (const file of files) {
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(file.content))) {
      const spec = m[1] || m[2];
      if (spec && !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("@/")) {
        usedBare.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
      }
    }
  }
  const missingDeps = [...usedBare].filter((d) => declared.length > 0 && !declared.includes(d) && !d.startsWith("node:"));
  const cycles = detectCycles(graph);
  const entry =
    files.find((f) => f.path === "src/router.tsx")?.path ||
    files.find((f) => f.path === "src/index.tsx" || f.path === "index.html")?.path ||
    files[0]?.path ||
    null;
  return {
    framework: frameworkOf(files),
    entry,
    routes,
    graph,
    cycles,
    missingDeps,
    declaredDeps: declared,
    complexity,
  };
}
