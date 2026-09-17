import { FLEET_GROUPS } from "@/lib/anvil/fleet";
import type { LaneView } from "@/lib/anvil/store";
import { cn } from "@/lib/utils";

function toneClass(tone: LaneView["tone"]) {
  if (tone === "danger") return "bg-danger";
  if (tone === "stale") return "bg-warn";
  if (tone === "live") return "bg-primary";
  return "bg-subtle/50";
}

export function MeshLattice({
  lanes,
  selected,
  onSelect,
}: {
  lanes: LaneView[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(lanes.map((l) => [l.id, l]));
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium tracking-tight">31-lane lattice</h2>
        <p className="font-mono text-xs tabular-nums text-muted">
          {lanes.filter((l) => l.tone === "live").length}/{lanes.length} live
        </p>
      </header>
      <div className="flex flex-col gap-3">
        {FLEET_GROUPS.map((g) => (
          <div key={g.id}>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.sources.map((id) => {
                const lane = byId.get(id);
                const tone = lane?.tone ?? "idle";
                const active = selected === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(id)}
                    className={cn(
                      "inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border px-2.5 text-left whitespace-nowrap transition-[border-color,background-color] duration-150",
                      active ? "border-primary/50 bg-raised" : "border-border bg-bg hover:border-fg/20",
                    )}
                    aria-pressed={active}
                    title={id}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", toneClass(tone), tone === "live" && "live-dot")} />
                    <span className="min-w-0 max-w-[10rem] truncate font-mono text-[11px] text-fg">{id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
