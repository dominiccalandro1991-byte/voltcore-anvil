import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { MAP_B } from "@/lib/engines/registry";
import { runLab, type LabResult } from "@/lib/engines/map-b";
import { recordRun } from "@/lib/engines/meter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { probeUrls } from "@/lib/server/probe";

export const Route = createFileRoute("/labs")({ component: LabsPage });

function LabsPage() {
  return (
    <Authed>
      <Labs />
    </Authed>
  );
}

function Labs() {
  const [slug, setSlug] = useState("anomaly-detector");
  const [input, setInput] = useState("10,12,11,10,55,9,11,10,80,12");
  const [out, setOut] = useState<LabResult | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = MAP_B.find((e) => e.slug === slug);

  async function run() {
    setBusy(true);
    try {
      if (slug === "target-node-selector" || slug === "edge-latency-matrix") {
        const urls = input.split(/\s+/).filter(Boolean);
        const res = await probeUrls({ data: { urls } });
        recordRun(slug);
        setOut({
          slug,
          ok: res.ok === res.n,
          elapsedMs: 0,
          output: { ...res, ranked: [...res.results].sort((a, b) => a.ms - b.ms) },
        });
      } else {
        const r = await runLab(slug, input);
        recordRun(slug);
        setOut(r);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Map B</p>
        <h1 className="text-2xl font-medium">Diagnostic labs</h1>
        <p className="text-sm text-muted mt-1">
          Pre-flight / post-flight instruments. Not 25 load generators.
        </p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {MAP_B.map((e) => (
          <button
            key={e.slug}
            type="button"
            onClick={() => setSlug(e.slug)}
            className={
              "min-h-11 rounded-md border px-3 py-2 text-left text-sm " +
              (slug === e.slug
                ? "border-primary bg-raised"
                : "border-border bg-surface text-muted hover:text-fg")
            }
          >
            <span className="font-mono text-[10px] text-primary">ENG-{String(e.id).padStart(2, "0")}</span>
            <div>{e.name}</div>
          </button>
        ))}
      </div>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <p className="text-sm text-muted">{meta?.role}</p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full min-h-28 rounded-md bg-raised border border-border px-3 py-2 font-mono text-sm"
        />
        <Button onClick={run} disabled={busy}>
          {busy ? "Running" : "Run instrument"}
        </Button>
        {out && (
          <pre className="overflow-auto max-h-80 text-xs font-mono bg-raised rounded-md p-3">
            {JSON.stringify(out, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
