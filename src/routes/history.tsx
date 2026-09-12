import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { listRuns, getRun } from "@/lib/server/runs";
import type { RunRow } from "@/lib/types";
import { fmtMs, fmtNum, fmtPct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { usseMarkdown } from "@/lib/engines/export-md";
import type { UsseReport } from "@/lib/engines/usse";

export const Route = createFileRoute("/history")({ component: Page });

function Page() {
  return (
    <Authed>
      <History />
    </Authed>
  );
}

function History() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    void listRuns().then(setRows).catch(() => setRows([]));
  }, []);

  async function inspect(id: string) {
    setOpen(id);
    const d = await getRun({ data: id });
    const summary = d.run?.summary;
    const usse =
      summary && typeof summary === "object" && !Array.isArray(summary) && "usse" in summary
        ? (summary.usse as UsseReport)
        : undefined;
    if (usse) setDetail(usseMarkdown(usse, d.run?.engine ?? ""));
    else
      setDetail(
        JSON.stringify(
          { run: d.run, ticks: d.ticks.length, vectors: d.vectors },
          null,
          2,
        ),
      );
  }

  function download(row: RunRow) {
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `anvil-${row.id.slice(0, 8)}.json`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Archive</p>
        <h1 className="text-2xl font-medium">Last 40 runs</h1>
      </header>
      {rows.length === 0 && (
        <p className="text-sm text-muted">No runs yet. Start a campaign from Command.</p>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg bg-surface border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {r.mode} · {r.engine}
                </p>
                <p className="text-[11px] font-mono text-muted">
                  {r.started_at} · {r.status}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => inspect(r.id)}>
                  Inspect
                </Button>
                <Button variant="quiet" onClick={() => download(r)}>
                  JSON
                </Button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono tabular">
              <span>risk {fmtNum(r.failure_risk, 4)}</span>
              <span>err {fmtPct(r.error_rate)}</span>
              <span>p99 {fmtMs(r.p99_ms)}</span>
              <span>ok {fmtPct(r.overall_success)}</span>
            </dl>
            {open === r.id && (
              <pre className="mt-3 overflow-auto max-h-72 text-xs font-mono bg-raised rounded-md p-3 whitespace-pre-wrap">
                {detail}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
