import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { FLEET } from "@/lib/engines/fleet";
import {
  probeFleet,
  runNaseIsolate,
  dispatchTelemetry,
  listMeshEvents,
  type MeshEvent,
} from "@/lib/server/mesh";
import { sandboxJob } from "@/lib/server/probe";
import { fmtMs } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { IsolateReport } from "@/lib/engines/isolate";

export const Route = createFileRoute("/mesh")({ component: Page });

function Page() {
  return (
    <Authed>
      <Mesh />
    </Authed>
  );
}

type FleetRow = {
  id: string;
  name: string;
  role: string;
  repo: string;
  probe: string;
  bind: string;
  ok: boolean;
  status: number | null;
  ms: number;
  error: string | null;
};

function Mesh() {
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [attest, setAttest] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(
    "stress 400 lb on a 0.3 m lever, 12 agents, 50 rps",
  );
  const [report, setReport] = useState<IsolateReport | null>(null);
  const [job, setJob] = useState("");
  const [events, setEvents] = useState<MeshEvent[]>([]);
  const [note, setNote] = useState("");

  async function scan() {
    setBusy(true);
    try {
      const r = await probeFleet();
      setRows(r.results);
      setAttest(r.s_attest);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void scan();
    void listMeshEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  async function isolate() {
    setBusy(true);
    try {
      const r = await runNaseIsolate({ data: { source } });
      setReport(r.report);
    } finally {
      setBusy(false);
    }
  }

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
    } finally {
      setBusy(false);
    }
  }

  async function ping() {
    setBusy(true);
    try {
      await dispatchTelemetry({
        data: { kind: "operator-ping", note: note || "mesh ping" },
      });
      const ev = await listMeshEvents();
      setEvents(ev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Mesh</p>
          <h1 className="text-2xl font-medium">Fleet + NASE</h1>
          <p className="text-sm text-muted mt-1">
            Status probes only. Heal and AUTONOMOUS_TRUNK are denied. ω_k = 1/25.
          </p>
        </div>
        <Button onClick={() => void scan()} disabled={busy}>
          {busy ? "Scanning" : "Scan fleet"}
        </Button>
      </header>

      <p className="text-[11px] font-mono break-all text-muted">
        S_attest {attest || "—"}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(rows ?? FLEET.map((n) => ({ ...n, ok: false, status: null, ms: 0, error: null }))).map(
          (n) => (
            <article
              key={n.id}
              className="rounded-lg bg-surface border border-border p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{n.name}</h2>
                <span
                  className={
                    "text-[10px] uppercase tracking-widest font-mono " +
                    (n.ok ? "text-ok" : "text-muted")
                  }
                >
                  {n.ok ? "up" : rows ? "down" : "idle"}
                </span>
              </div>
              <p className="text-xs text-muted">{n.role}</p>
              <p className="text-[11px] font-mono text-muted tabular">
                {n.status ?? "—"} · {fmtMs(n.ms)} · {n.bind}
              </p>
              <a
                href={n.repo}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Repository
              </a>
              {n.error && <p className="text-[11px] text-danger">{n.error}</p>}
            </article>
          ),
        )}
      </div>

      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted">NASE isolate</h2>
        <p className="text-xs text-muted">
          Token analysis, arithmetic, JSON, or USSE intent. Ephemeral. No network from the
          snippet. /heal is rejected.
        </p>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={4}
          className="w-full rounded-md bg-raised border border-border px-3 py-2 font-mono text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void isolate()} disabled={busy || !source.trim()}>
            Run isolate
          </Button>
          <Button variant="ghost" onClick={() => void hammer()} disabled={busy}>
            Remote /jobs (usse-stress)
          </Button>
        </div>
        {report && (
          <pre className="overflow-auto max-h-80 text-xs font-mono bg-raised rounded-md p-3">
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
        {job && (
          <pre className="overflow-auto max-h-64 text-xs font-mono bg-raised rounded-md p-3">
            {job}
          </pre>
        )}
      </section>

      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted">Telemetry</h2>
        <p className="text-xs text-muted">
          POSTs to your public webhook if enabled in Settings (Monday-compatible JSON). SSRF
          deny applies. No secrets in the payload.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ping note"
            className="flex-1 min-h-11 rounded-md bg-raised border border-border px-3 text-sm"
          />
          <Button variant="quiet" onClick={() => void ping()} disabled={busy}>
            Dispatch ping
          </Button>
        </div>
        <ul className="space-y-1 text-xs font-mono text-muted">
          {events.length === 0 && <li>No events yet.</li>}
          {events.map((e) => (
            <li key={e.id}>
              {e.created_at} · {e.kind} · {e.delivered ? "delivered" : "queued"}
              {e.error ? ` · ${e.error}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
