import { PHASES, phaseIndex } from "@/lib/anvil/hammer-forge";
import type { ForgeState } from "@/lib/anvil/types";
import { cn } from "@/lib/utils";

export function ScoreDial({ forge }: { forge: ForgeState }) {
  const score = forge.score;
  const total = score?.total ?? 0;
  const idx = phaseIndex(forge.phase);
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Forge score</p>
          <p className="mt-1 font-mono text-5xl font-medium tabular-nums tracking-tight text-fg">
            {score ? total : "—"}
            <span className="ml-1 text-base text-muted">/100</span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
          {(
            [
              ["mem", score?.memory],
              ["con", score?.concurrency],
              ["cmp", score?.compile],
              ["hyg", score?.hygiene],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-subtle">{k}</dt>
              <dd className="tabular-nums text-fg">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ol className="mt-4 flex flex-wrap gap-1.5">
        {PHASES.map((p, i) => (
          <li
            key={p}
            className={cn(
              "rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
              i <= idx && forge.phase !== "idle" ? "bg-raised text-primary" : "text-subtle",
            )}
          >
            {p}
          </li>
        ))}
      </ol>
    </section>
  );
}
