import { ingestFiles } from "./ingest.ts";
import type { IngestedBundle } from "./types.ts";

type Raw = { path: string; content: string };

const LEAKY: Raw[] = [
  {
    path: "package.json",
    content: JSON.stringify(
      { name: "leaky-spa", type: "module", dependencies: { react: "19.0.0" } },
      null,
      2,
    ),
  },
  {
    path: ".env.local",
    content: "SUPABASE_SERVICE_ROLE=super-secret-role-key\nOPENAI_KEY=sk-abcdefghijklmnopqrstuvwxyz0123456789\n",
  },
  {
    path: "src/index.tsx",
    content: `import { mount } from "./app.ts";
const cache: string[] = [];
setInterval(() => {
  cache.push(new Array(1024).join("x"));
  document.body.addEventListener("click", () => cache.push("click"));
}, 200);
mount();
`,
  },
  {
    path: "src/app.tsx",
    content: `import { fetchStatus } from "./net.ts";
let state = { n: 0 };
export function mount() {
  while (true) {
    state.n += 1;
    if (state.n > 1e9) break;
  }
  fetchStatus();
}
`,
  },
  {
    path: "src/net.ts",
    content: `export function fetchStatus() {
  fetch("/api/status");
  eval("window.__leak = true");
}
`,
  },
  {
    path: "index.html",
    content: `<!doctype html><html><body><div id="root"></div><script type="module" src="/src/index.tsx"></script></body></html>`,
  },
];

const RACY: Raw[] = [
  {
    path: "package.json",
    content: JSON.stringify(
      {
        name: "racy-api",
        type: "module",
        dependencies: { hono: "4.0.0" },
      },
      null,
      2,
    ),
  },
  {
    path: "src/server.ts",
    content: `import { handle } from "./routes/api/tick.ts";
import { store } from "./store.ts";
export default {
  fetch(req: Request) {
    handle(req);
    return new Response(String(store.counter));
  }
};
`,
  },
  {
    path: "src/store.ts",
    content: `export let counter = 0;
export const cache: number[] = [];
`,
  },
  {
    path: "src/routes/api/tick.ts",
    content: `import { counter, cache } from "../store.ts";
import { handle as peer } from "./peer.ts";
export function handle(req: Request) {
  counter += 1;
  cache.push(Date.now());
  fetch("https://example.com/write");
  return peer(req);
}
`,
  },
  {
    path: "src/routes/api/peer.ts",
    content: `import { handle as tick } from "./tick.ts";
export function handle(req: Request) {
  return tick(req);
}
`,
  },
];

const CLEAN: Raw[] = [
  {
    path: "package.json",
    content: JSON.stringify(
      {
        name: "quench-ssr",
        type: "module",
        dependencies: { "@tanstack/react-start": "1.168.0", react: "19.2.0" },
      },
      null,
      2,
    ),
  },
  {
    path: "src/router.tsx",
    content: `import { createRouter } from "@tanstack/react-router";
export function getRouter() {
  return createRouter({ routeTree: {} as never });
}
`,
  },
  {
    path: "src/routes/index.tsx",
    content: `export function Home() {
  return <main>Quench</main>;
}
`,
  },
  {
    path: "src/lib/session.ts",
    content: `const timers = new Set<ReturnType<typeof setInterval>>();
export function start(ms: number, fn: () => void) {
  const id = setInterval(fn, ms);
  timers.add(id);
  return id;
}
export function stop(id: ReturnType<typeof setInterval>) {
  clearInterval(id);
  timers.delete(id);
}
export function dispose() {
  for (const id of timers) clearInterval(id);
  timers.clear();
}
`,
  },
  {
    path: "src/lib/net.ts",
    content: `export async function ping(url: string) {
  const res = await fetch(url);
  return res.ok;
}
`,
  },
  {
    path: "vercel.json",
    content: JSON.stringify(
      {
        rewrites: [{ source: "/(.*)", destination: "/" }],
        headers: [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] }],
      },
      null,
      2,
    ),
  },
  {
    path: "index.html",
    content: `<!doctype html><html><body><div id="root"></div></body></html>`,
  },
];

export const FIXTURES: { id: string; label: string; hint: string; build: () => IngestedBundle }[] = [
  {
    id: "leaky-spa",
    label: "Leaky SPA",
    hint: "Secrets, interval leak, unbounded growth",
    build: () => ingestFiles("leaky-spa", "fixture", LEAKY),
  },
  {
    id: "racy-api",
    label: "Racy API",
    hint: "Shared counter, import cycle, missing await",
    build: () => ingestFiles("racy-api", "fixture", RACY),
  },
  {
    id: "quench-ssr",
    label: "Quench SSR",
    hint: "Hardened TanStack Start sample",
    build: () => ingestFiles("quench-ssr", "fixture", CLEAN),
  },
];
