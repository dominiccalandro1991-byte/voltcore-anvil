import { useEffect, useRef } from "react";
import { Anvil, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BEAT_MS, FLEET, LANE_CEILING, POLL_MS, TRUNK_ORIGIN } from "@/lib/anvil/fleet";
import { latticeIds } from "@/lib/anvil/telemetry";
import { laneViews, startForgeLoop, stopForgeLoop, useAnvil } from "@/lib/anvil/store";
import type { FleetSnapshot, MeshEvent } from "@/lib/anvil/types";
import { cn } from "@/lib/utils";
import { IngestPanel } from "./ingest-panel";
import { MeshLattice } from "./lattice";
import { ManifestPanel } from "./manifest-panel";
import { ScoreDial } from "./score-dial";
import { DualTraces } from "./traces";

export function ForgeApp({
  initial,
  embedded = false,
}: {
  initial?: { health: FleetSnapshot | null; events: MeshEvent[]; now: number };
  embedded?: boolean;
}) {
  const seeded = useRef(false);
  if (initial && !seeded.current) {
    seeded.current = true;
    useAnvil.getState().seedMesh(initial.health, initial.events, initial.now);
  }
  const forge = useAnvil((s) => s.forge);
  const running = useAnvil((s) => s.running);
  const storeLink = useAnvil((s) => s.link);
  const storeHealth = useAnvil((s) => s.health);
  const storeLanes = useAnvil((s) => s.lanes);
  const events = useAnvil((s) => s.events);
  const history = useAnvil((s) => s.history);
  const selectedLane = useAnvil((s) => s.selectedLane);
  const paste = useAnvil((s) => s.paste);
  const fixtureId = useAnvil((s) => s.fixtureId);
  const lastPost = useAnvil((s) => s.lastPost);
  const strike = useAnvil((s) => s.strike);
  const stop = useAnvil((s) => s.stop);
  const loadFixture = useAnvil((s) => s.loadFixture);
  const loadPaste = useAnvil((s) => s.loadPaste);
  const loadDrop = useAnvil((s) => s.loadDrop);
  const selectLane = useAnvil((s) => s.selectLane);
  const setPaste = useAnvil((s) => s.setPaste);
  const syncMesh = useAnvil((s) => s.syncMesh);
  const beat = useAnvil((s) => s.beat);
  const hydrateHistory = useAnvil((s) => s.hydrateHistory);

  useEffect(() => {
    startForgeLoop();
    hydrateHistory();
    void syncMesh();
    void beat();
    const poll = window.setInterval(() => void syncMesh(), POLL_MS);
    const hb = window.setInterval(() => void beat(), BEAT_MS);
    return () => {
      stopForgeLoop();
      window.clearInterval(poll);
      window.clearInterval(hb);
    };
  }, [syncMesh, beat, hydrateHistory]);

  const selected = events.find((e) => e.source === selectedLane) ?? null;
  const findings = [...forge.aegis.findings, ...forge.striker.findings].slice(0, 8);
  const health = storeHealth ?? initial?.health ?? null;
  const liveStored = storeLanes.filter((l) => l.tone === "live").length;
  const lanes =
    liveStored > 0 || !initial
      ? storeLanes
      : laneViews(
          initial.events,
          initial.now,
          latticeIds(initial.health).length ? latticeIds(initial.health) : Object.keys(FLEET),
        );
  const link = health ? (storeLink === "syncing" && liveStored === 0 ? "live" : storeLink) : storeLink;

  return (
    <div className={cn(embedded ? "bg-bg text-fg" : "min-h-dvh bg-bg text-fg")}>
      {!embedded ? (
        <header className="sticky top-0 z-20 border-b border-border bg-bg/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">VoltCore // Anvil</p>
              <h1 className="truncate text-lg font-medium tracking-tight">HammerForge module</h1>
            </div>
            <StatusChip link={link} onRefresh={() => void syncMesh()} spinning={link === "syncing"} />
          </div>
          <StatusRow
            lanes={lanes}
            health={health}
            phase={forge.phase}
            lastPost={lastPost}
            ceiling={LANE_CEILING}
          />
        </header>
      ) : null}

      <div className={cn("mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4", embedded ? "pb-8" : "pb-24")}>
        {embedded ? (
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Authenticated module</p>
              <h1 className="text-2xl font-medium">HammerForge</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                In-process hardening pipeline. Aegis and Striker are 48-tick simulations on an uploaded
                tree — not remote authorized testers. Mesh posts go to the open Worker events ingest.
              </p>
            </div>
            <StatusChip link={link} onRefresh={() => void syncMesh()} spinning={link === "syncing"} />
          </header>
        ) : null}

        {embedded ? (
          <StatusRow
            lanes={lanes}
            health={health}
            phase={forge.phase}
            lastPost={lastPost}
            ceiling={LANE_CEILING}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={strike}>
            <Anvil className="size-4" />
            Strike
          </Button>
          <Button variant="ghost" onClick={stop} disabled={!running}>
            Halt
          </Button>
          <p className="font-mono text-xs text-muted">
            {forge.bundle?.name ?? "no bundle"} · tick {forge.tick}
          </p>
        </div>

        <ScoreDial forge={forge} />
        <DualTraces aegis={forge.aegis} striker={forge.striker} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <IngestPanel
            fixtureId={fixtureId}
            paste={paste}
            fileCount={forge.bundle?.files.length ?? 0}
            bytes={forge.bundle?.bytes ?? 0}
            merkle={forge.bundle?.merkle ?? null}
            onFixture={loadFixture}
            onPasteChange={setPaste}
            onPasteLoad={loadPaste}
            onDrop={(files) => void loadDrop(files)}
          />
          <ManifestPanel forge={forge} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <MeshLattice lanes={lanes} selected={selectedLane} onSelect={selectLane} />
          <section className="rounded-xl border border-border bg-surface p-4">
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-medium tracking-tight">Findings · log</h2>
              <Radio className="size-3.5 text-muted" />
            </header>
            {findings.length === 0 ? (
              <p className="text-sm text-muted">
                No pipeline flags yet. Strike a bundle to run in-process Aegis and Striker simulations.
              </p>
            ) : (
              <ul className="space-y-2">
                {findings.map((f, i) => (
                  <li key={`${f.kind}-${i}`} className="border-b border-border/70 pb-2 last:border-0">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">{f.kind}</p>
                    <p className="text-sm text-fg">{f.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <ol className="mt-4 max-h-40 space-y-1 overflow-auto font-mono text-[11px] text-muted">
              {forge.log
                .slice(-12)
                .reverse()
                .map((row, i) => (
                  <li key={`${row.phase}-${i}-${row.message.slice(0, 24)}`}>
                    <span className="text-subtle">{row.phase}</span> {row.message}
                  </li>
                ))}
            </ol>
            {selected ? (
              <div className="mt-4 rounded-md bg-bg p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-subtle">{selected.source}</p>
                <p className="text-sm text-fg">
                  {selected.event_type} · {selected.severity}
                </p>
                <p className="font-mono text-[11px] text-muted">{selected.created_at}</p>
              </div>
            ) : null}
          </section>
        </div>

        {history.length > 0 ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium tracking-tight">Prior strikes</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {history.map((h) => (
                <li key={h.id} className="rounded-md border border-border bg-bg px-3 py-2">
                  <p className="truncate text-sm text-fg">{h.name}</p>
                  <p className="font-mono text-xs tabular-nums text-muted">
                    {h.score}/100 · {h.verdict}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="pb-[env(safe-area-inset-bottom)] font-mono text-[10px] text-subtle">
          Mesh trunk {TRUNK_ORIGIN.replace("https://", "")} · POST /api/v1/events source=voltcore-anvil
          (open ingest, not HMAC). Lattice ceiling stays {LANE_CEILING}. This widget does not write lane
          membership.
        </p>
      </div>
    </div>
  );
}

function StatusChip({
  link,
  onRefresh,
  spinning,
}: {
  link: string;
  onRefresh: () => void;
  spinning: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={cn(
          "inline-flex min-h-10 items-center rounded-full border px-3 font-mono text-xs",
          link === "offline" || link === "local"
            ? "border-warn/40 text-warn"
            : "border-primary/40 bg-primary/10 text-primary",
        )}
      >
        <span className={cn("mr-2 size-1.5 rounded-full bg-current", link === "live" && "live-dot")} />
        {link === "syncing" ? "SYNC" : link === "live" ? "LIVE" : link === "local" ? "LOCAL" : "OFF"}
      </span>
      <Button size="icon" variant="secondary" aria-label="Refresh mesh" onClick={onRefresh}>
        <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
      </Button>
    </div>
  );
}

function StatusRow({
  lanes,
  health,
  phase,
  lastPost,
  ceiling,
}: {
  lanes: { tone: string }[];
  health: FleetSnapshot | null;
  phase: string;
  lastPost: string | null;
  ceiling: number;
}) {
  return (
    <dl className="flex gap-4 overflow-x-auto px-0 pb-1 font-mono text-xs text-muted md:px-0">
      <div className="shrink-0">
        <dt className="inline text-subtle">LANES </dt>
        <dd className="inline tabular-nums text-fg">
          {lanes.filter((l) => l.tone === "live").length}/{ceiling}
        </dd>
      </div>
      <div className="shrink-0">
        <dt className="inline text-subtle">TRUNK </dt>
        <dd className="inline text-fg">
          {health?.supabase ? "sb" : "—"} {health?.mesh ? "mesh" : ""} {health?.cron ? "cron" : ""}
        </dd>
      </div>
      <div className="shrink-0">
        <dt className="inline text-subtle">PHASE </dt>
        <dd className="inline text-fg">{phase}</dd>
      </div>
      <div className="min-w-0 truncate">
        <dt className="inline text-subtle">POST </dt>
        <dd className="inline text-fg">{lastPost ?? "—"}</dd>
      </div>
    </dl>
  );
}
