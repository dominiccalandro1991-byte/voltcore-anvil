import { useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "./ui/button";
import { useAnvil } from "@/lib/store";
import { executeCampaign, type RunConfig } from "@/lib/runner";
import { fmtMs, fmtNum, fmtPct } from "@/lib/utils";
import { HISTOGRAM_EDGES, type RunMode } from "@/lib/engines/constants";
import { emptyHistogram } from "@/lib/engines/hash";
import type { Tick } from "@/lib/engines/probe";

const MODES: { id: RunMode; label: string; hint: string }[] = [
  { id: "unified", label: "Unified", hint: "USSE fused risk" },
  { id: "physical", label: "Physical", hint: "torque / σ" },
  { id: "digital", label: "Digital", hint: "pressure scalar" },
  { id: "live", label: "Live", hint: "bounded HTTP" },
  { id: "virtual", label: "Virtual", hint: "VSTE ×4" },
  { id: "hybrid", label: "Hybrid", hint: "VSTE + subsample" },
];

export function CommandCenter() {
  const s = useAnvil();
  const abortRef = useRef(false);

  const cfg = (): RunConfig => ({
    mode: s.mode,
    authorized: s.authorized,
    frontend: s.frontend,
    backend: s.backend,
    specText: s.specText,
    loadLb: s.loadLb,
    leverM: s.leverM,
    agents: s.agents,
    rps: s.rps,
    p99: s.p99,
    errorRate: s.errorRate,
    yieldPa: s.yieldPa,
    vu: s.vu,
    duration: s.duration,
    ramp: s.ramp,
    think: s.think,
    maxReq: s.maxReq,
    khC: s.khC,
    khR: s.khR,
  });

  async function start() {
    if (s.running) return;
    abortRef.current = false;
    s.patch({
      running: true,
      aborting: false,
      usse: null,
      vectors: [],
      ticks: [],
      statusNote: "Starting…",
    });
    try {
      const id = await executeCampaign(cfg(), {
        onNote: (n) => s.patch({ statusNote: n }),
        onTick: (t) =>
          s.patch({ ticks: [...useAnvil.getState().ticks.slice(-240), t] }),
        onVector: (v) =>
          s.patch({ vectors: [...useAnvil.getState().vectors, v] }),
        onUsse: (r) =>
          s.patch({
            usse: r.report,
            sAttest: r.attestation.s_attest,
            weighted: r.attestation.weighted_sum,
            phi: r.attestation.vectors,
            runId: r.run.id,
          }),
        shouldAbort: () => abortRef.current,
      });
      s.patch({ runId: id, running: false });
    } catch (err) {
      s.patch({
        running: false,
        statusNote: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function abort() {
    abortRef.current = true;
    s.patch({ aborting: true, statusNote: "Aborting inflight VUs…" });
  }

  const last = s.ticks[s.ticks.length - 1];
  const hist = useMemo(() => {
    const bins = emptyHistogram();
    for (const t of s.ticks) {
      /* ticks already aggregated; synthesize from p99 as display fallback */
      void t;
    }
    const labels = ["0–20", "20–50", "50–100", "100–200", "200–500", "500–1k", "1–2k", "2–5k", "5k+"];
    if (!s.ticks.length) {
      return labels.map((name, i) => ({ name, n: bins[i] ?? 0 }));
    }
    const counts: number[] = emptyHistogram();
    for (const t of s.ticks) {
      const ms = t.p50;
      const edges = HISTOGRAM_EDGES;
      let idx: number = edges.length;
      for (let i = 0; i < edges.length; i += 1) if (ms < edges[i]!) {
        idx = i;
        break;
      }
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    return labels.map((name, i) => ({ name, n: counts[i] ?? 0 }));
  }, [s.ticks]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Command center</p>
          <h1 className="text-2xl font-medium">Stress campaign</h1>
        </div>
        <p className="text-xs font-mono text-muted tabular">{s.statusNote}</p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => s.patch({ mode: m.id })}
            className={
              "min-h-11 rounded-md border px-3 py-2 text-left " +
              (s.mode === m.id
                ? "border-primary bg-raised text-primary"
                : "border-border bg-surface text-muted hover:text-fg")
            }
          >
            <div className="text-sm font-medium text-fg">{m.label}</div>
            <div className="text-[11px] text-muted">{m.hint}</div>
          </button>
        ))}
      </section>

      <section className="rounded-lg bg-surface border border-border p-4 space-y-4">
        <label className="flex items-start gap-3 min-h-11">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={s.authorized}
            onChange={(e) => s.patch({ authorized: e.target.checked })}
          />
          <span className="text-sm">
            I own or am authorized to test this origin.
            <span className="block text-xs text-muted">
              Required. Persisted with the run. Private hosts are denied.
            </span>
          </span>
        </label>

        {(s.mode === "live" || s.mode === "virtual" || s.mode === "hybrid") && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field
              label="Frontend origin"
              value={s.frontend}
              onChange={(v) => s.patch({ frontend: v })}
            />
            <Field
              label="Backend origin"
              value={s.backend}
              onChange={(v) => s.patch({ backend: v })}
            />
          </div>
        )}

        {(s.mode === "unified" || s.mode === "physical" || s.mode === "digital") && (
          <>
            <textarea
              value={s.specText}
              onChange={(e) => s.patch({ specText: e.target.value })}
              placeholder="Paste a spec (≥40 chars, physics / agents / load) or use the fields."
              className="w-full min-h-24 rounded-md bg-raised border border-border px-3 py-2 text-sm font-mono"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Num label="Load lb" value={s.loadLb} onChange={(v) => s.patch({ loadLb: v })} />
              <Num label="Lever m" value={s.leverM} step={0.05} onChange={(v) => s.patch({ leverM: v })} />
              <Num label="Yield Pa" value={s.yieldPa} onChange={(v) => s.patch({ yieldPa: v })} />
              <Num label="Agents" value={s.agents} onChange={(v) => s.patch({ agents: v })} />
              <Num label="RPS" value={s.rps} onChange={(v) => s.patch({ rps: v })} />
              <Num label="p99 ms" value={s.p99} onChange={(v) => s.patch({ p99: v })} />
              <Num
                label="Error rate"
                value={s.errorRate}
                step={0.01}
                onChange={(v) => s.patch({ errorRate: v })}
              />
            </div>
          </>
        )}

        {s.mode === "live" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Num label="VU ≤50" value={s.vu} onChange={(v) => s.patch({ vu: v })} />
            <Num label="Duration s ≤120" value={s.duration} onChange={(v) => s.patch({ duration: v })} />
            <Num label="Ramp s" value={s.ramp} onChange={(v) => s.patch({ ramp: v })} />
            <Num label="Think ms" value={s.think} onChange={(v) => s.patch({ think: v })} />
            <Num label="Max req ≤1000" value={s.maxReq} onChange={(v) => s.patch({ maxReq: v })} />
            <Num label="KeyHarbor C" value={s.khC} onChange={(v) => s.patch({ khC: v })} />
            <Num label="KeyHarbor R/s" value={s.khR} onChange={(v) => s.patch({ khR: v })} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={start} disabled={s.running || !s.authorized}>
            {s.running ? "Running" : "Start"}
          </Button>
          <Button variant="danger" onClick={abort} disabled={!s.running}>
            Abort
          </Button>
        </div>
      </section>

      {s.usse && <UssePanel />}
      {s.vectors.length > 0 && <VstePanel />}
      {(s.mode === "live" || s.ticks.length > 0) && (
        <LivePanel last={last} ticks={s.ticks} hist={hist} />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm text-fg font-mono"
      />
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm text-fg tabular font-mono"
      />
    </label>
  );
}

function UssePanel() {
  const u = useAnvil((s) => s.usse)!;
  const trip = u.fused.failure_risk >= 0.85;
  return (
    <section className="rounded-lg bg-surface border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-widest text-muted">USSE</h2>
        <span className={trip ? "text-danger text-sm" : "text-primary text-sm"}>
          {u.passed ? "PASSED" : "FAILED"} · risk {u.fused.failure_risk.toFixed(4)}
        </span>
      </div>
      {u.error && <p className="text-danger text-sm">{u.error}</p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <Meter label="Utilization" value={u.physical.utilization} max={2} danger />
        <Meter label="Digital pressure / 50" value={u.digital.digital_pressure / 50} max={1} />
        <Meter label="Failure risk" value={u.fused.failure_risk} max={1} trip={0.85} />
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-mono tabular">
        <Stat k="mass_kg" v={fmtNum(u.physical.mass_kg, 4)} />
        <Stat k="torque_nm" v={fmtNum(u.physical.torque_nm)} />
        <Stat k="moment_nm" v={fmtNum(u.physical.moment_nm)} />
        <Stat k="σ_pa" v={fmtNum(u.physical.bending_stress_pa, 2)} />
        <Stat k="agents" v={String(u.digital.agent_count)} />
        <Stat k="score" v={fmtNum(u.score, 6)} />
        <Stat k="NASE" v={u.nase.att_ok ? "fresh" : "stale"} />
        <Stat k="threshold" v="0.85" />
      </dl>
    </section>
  );
}

function VstePanel() {
  const vectors = useAnvil((s) => s.vectors);
  return (
    <section className="grid sm:grid-cols-2 gap-3">
      {vectors.map((v) => (
        <article key={v.vector} className="rounded-lg bg-surface border border-border p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{v.vector.replaceAll("_", " ")}</h3>
            <span className="text-xs font-mono tabular text-primary">
              {fmtPct(v.success_rate)}
            </span>
          </div>
          <p className="text-[11px] font-mono text-muted leading-relaxed">{v.equation}</p>
          <p className="text-xs text-muted tabular">
            {v.samples} samples · {v.failures} fail · {fmtMs(v.elapsed_ms)}
          </p>
          {v.failure_telemetry.length > 0 && (
            <ul className="text-[11px] font-mono text-danger max-h-24 overflow-auto space-y-1">
              {v.failure_telemetry.slice(0, 6).map((f) => (
                <li key={f.index}>
                  #{f.index} {f.error_code}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </section>
  );
}

function LivePanel({
  last,
  ticks,
  hist,
}: {
  last?: Tick;
  ticks: Tick[];
  hist: { name: string; n: number }[];
}) {
  return (
    <section className="rounded-lg bg-surface border border-border p-4 space-y-4">
      <h2 className="text-sm uppercase tracking-widest text-muted">Live telemetry</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono tabular text-sm">
        <Stat k="inflight" v={String(last?.inflight ?? 0)} />
        <Stat k="rps" v={fmtNum(last?.rps ?? 0, 2)} />
        <Stat k="error" v={fmtPct(last?.error_rate ?? 0)} />
        <Stat k="p99" v={fmtMs(last?.p99)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ticks}>
              <XAxis dataKey="t_ms" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#10151c", border: "1px solid #243038" }}
              />
              <Area dataKey="inflight" stroke="#2ee6d6" fill="#2ee6d622" />
              <Area dataKey="rps" stroke="#8aa0a8" fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hist}>
              <XAxis dataKey="name" tick={{ fill: "#8aa0a8", fontSize: 10 }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#10151c", border: "1px solid #243038" }}
              />
              <Bar dataKey="n" fill="#2ee6d6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function Meter({
  label,
  value,
  max,
  danger,
  trip,
}: {
  label: string;
  value: number;
  max: number;
  danger?: boolean;
  trip?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const over = trip != null ? value >= trip : danger && pct > 70;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>{label}</span>
        <span className="tabular font-mono">{fmtNum(value, 4)}</span>
      </div>
      <div className="h-2 rounded-full bg-raised overflow-hidden">
        <div
          className={"h-full " + (over ? "bg-danger" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-raised px-3 py-2">
      <dt className="text-[10px] uppercase tracking-widest text-muted">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}
