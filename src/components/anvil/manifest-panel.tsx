import { manifestJson } from "@/lib/anvil/pack";
import type { ForgeState } from "@/lib/anvil/types";
import { cn } from "@/lib/utils";

export function ManifestPanel({ forge }: { forge: ForgeState }) {
  const pack = forge.pack;
  const score = forge.score;
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Vercel pack</h2>
        {score ? (
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
              score.verdict === "hardened"
                ? "border-primary/40 text-primary"
                : score.verdict === "conditional"
                  ? "border-warn/40 text-warn"
                  : "border-danger/40 text-danger",
            )}
          >
            {score.verdict}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-subtle">pending</span>
        )}
      </header>
      {pack ? (
        <>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs text-muted">
            <div>
              <dt className="text-subtle">output</dt>
              <dd className="text-fg">{pack.output}</dd>
            </div>
            <div>
              <dt className="text-subtle">framework</dt>
              <dd className="text-fg">{pack.framework}</dd>
            </div>
            <div>
              <dt className="text-subtle">rewrites</dt>
              <dd className="text-fg tabular-nums">{pack.rewrites.length}</dd>
            </div>
            <div>
              <dt className="text-subtle">builds</dt>
              <dd className="text-fg">{pack.builds[0]?.use ?? "—"}</dd>
            </div>
          </dl>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {pack.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-bg p-3 font-mono text-[10px] leading-relaxed text-muted">
            {manifestJson(pack)}
          </pre>
        </>
      ) : (
        <p className="text-sm text-muted">Manifest emits after Aegis and Striker converge.</p>
      )}
    </section>
  );
}
