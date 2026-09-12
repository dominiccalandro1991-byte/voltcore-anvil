import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { computeAttestation } from "@/lib/server/runs";
import { sandboxJob } from "@/lib/server/probe";
import { MAP_A } from "@/lib/engines/registry";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { PhiVector } from "@/lib/engines/nase";

export const Route = createFileRoute("/attest")({ component: Page });

function Page() {
  return (
    <Authed>
      <Attest />
    </Authed>
  );
}

function Attest() {
  const [phi, setPhi] = useState<PhiVector[]>([]);
  const [sum, setSum] = useState<number | null>(null);
  const [hex, setHex] = useState("");
  const [job, setJob] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const a = await computeAttestation();
    setPhi(a.vectors);
    setSum(a.weighted_sum);
    setHex(a.s_attest);
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15000);
    return () => clearInterval(t);
  }, []);

  async function hammer() {
    setBusy(true);
    try {
      const r = await sandboxJob({
        data: {
          validator_id: "usse-stress",
          payload: {
            mode: "unified",
            load_lb: 400,
            lever_arm_m: 0.3,
            attestation_timestamp: Date.now() / 1000,
          },
          seed: 1,
        },
      });
      setJob(JSON.stringify(r, null, 2));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Map C</p>
        <h1 className="text-2xl font-medium">S_attest</h1>
        <p className="text-sm text-muted mt-1">
          Uniform ω_k = 1/25. Custom payloads against the 25-engine attestation surface.
        </p>
      </header>
      <div className="rounded-lg bg-surface border border-border p-4 space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted">weighted_sum</p>
        <p className="text-3xl font-mono tabular text-primary">{sum?.toFixed(12) ?? "—"}</p>
        <p className="text-[11px] font-mono break-all text-muted">{hex || "computing…"}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {phi.map((v) => (
          <div key={v.engine_id} className="flex items-center gap-3 py-1">
            <span className="w-6 text-[10px] font-mono text-muted tabular">{String(v.k).padStart(2, "0")}</span>
            <span className="w-40 truncate text-xs">{v.engine_id}</span>
            <div className="flex-1 h-2 rounded-full bg-raised overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${v.phi * 100}%` }} />
            </div>
            <span className="w-14 text-right text-[11px] font-mono tabular">{v.phi.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm">Sandbox job proxy</h2>
        <p className="text-xs text-muted">
          POSTs to nano-sandbox-api. Offline skip is expected — local φ vector still updates.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={hammer} disabled={busy}>
            {busy ? "Submitting" : "Hammer usse-stress"}
          </Button>
          <Button variant="ghost" onClick={() => void refresh()}>
            Recompute φ
          </Button>
        </div>
        <p className="text-[11px] text-muted">
          Registry: {MAP_A.map((e) => e.id).join(" · ")}
        </p>
        {job && <pre className="overflow-auto max-h-64 text-xs font-mono bg-raised rounded-md p-3">{job}</pre>}
      </section>
    </div>
  );
}
