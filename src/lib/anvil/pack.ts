import type { CompileReport, ForgeScore, IngestedBundle, VercelManifest } from "./types.ts";

/** O(r) over compiled routes. Emits a Vercel-ready routing manifest. */
export function packManifest(
  bundle: IngestedBundle,
  compile: CompileReport,
  score: ForgeScore,
): VercelManifest {
  const ssr = compile.routes.some((r) => r.kind === "ssr" || r.kind === "api");
  const output: VercelManifest["output"] =
    compile.framework === "tanstack-start" || compile.framework === "next" || ssr
      ? compile.routes.some((r) => r.kind === "static" || r.kind === "asset")
        ? "hybrid"
        : "ssr"
      : "static";

  const use =
    compile.framework === "next"
      ? "@vercel/next"
      : output === "static"
        ? "@vercel/static"
        : "@vercel/node";

  const builds = [{ src: compile.entry || "package.json", use }];
  const routes: VercelManifest["routes"] = [];
  const rewrites: VercelManifest["rewrites"] = [];
  const headers: VercelManifest["headers"] = [
    {
      source: "/(.*)",
      headers: [
        { key: "X-VoltCore-Anvil", value: score.verdict },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ];

  for (const r of compile.routes) {
    if (r.kind === "asset") {
      routes.push({
        src: r.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      });
    } else if (r.kind === "api") {
      const src = r.path.startsWith("/") ? r.path : "/" + r.path;
      rewrites.push({ source: src, destination: src });
    } else if (r.kind === "ssr") {
      const dest = output === "static" ? "/index.html" : r.path || "/";
      rewrites.push({ source: r.dynamic ? r.path.replace(/\[.+?\]/g, ":param") : r.path || "/", destination: dest });
    }
  }

  if (output !== "static") {
    rewrites.push({ source: "/(.*)", destination: "/" });
  } else if (!rewrites.some((w) => w.source === "/(.*)")) {
    rewrites.push({ source: "/(.*)", destination: "/index.html" });
  }

  const notes: string[] = [];
  notes.push(`Framework ${compile.framework} · output ${output}`);
  notes.push(`Forge ${score.verdict} ${score.total}/100`);
  if (compile.missingDeps.length) notes.push(`Missing deps: ${compile.missingDeps.slice(0, 6).join(", ")}`);
  if (compile.cycles.length) notes.push(`${compile.cycles.length} import cycle(s) — SSR graph may stall`);
  if (!score.ready) notes.push("Not production-ready — rerun after Aegis/Striker findings clear");

  return {
    version: 3,
    name: bundle.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "anvil-pack",
    framework: compile.framework,
    builds,
    routes,
    rewrites,
    headers,
    output,
    regions: ["iad1"],
    notes,
  };
}

export function manifestJson(m: VercelManifest): string {
  return JSON.stringify(
    {
      version: m.version,
      name: m.name,
      builds: m.builds,
      routes: m.routes,
      rewrites: m.rewrites,
      headers: m.headers,
    },
    null,
    2,
  );
}
