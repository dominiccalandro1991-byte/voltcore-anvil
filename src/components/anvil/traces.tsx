import type { AegisState, StrikerState } from "@/lib/anvil/types";

function linePath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function AegisTrace({ aegis }: { aegis: AegisState }) {
  const w = 640;
  const h = 168;
  const pad = 12;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const samples = aegis.samples;
  const max = Math.max(1, ...samples.map((s) => s.liveBytes));
  const hot = aegis.findings.some((f) => f.severity === "error");
  const pts = samples.map((s, i) => ({
    x: pad + (i / Math.max(1, samples.length - 1)) * innerW,
    y: pad + innerH - (s.liveBytes / max) * innerH,
  }));
  const area = pts.length
    ? `${linePath(pts)} L${pad + innerW} ${pad + innerH} L${pad} ${pad + innerH} Z`
    : "";
  const stroke = hot ? "var(--color-danger)" : "var(--color-primary)";
  const fill = hot ? "color-mix(in oklab, var(--color-danger) 16%, transparent)" : "color-mix(in oklab, var(--color-primary) 16%, transparent)";

  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Aegis · memory</h2>
        <p className="font-mono text-xs tabular-nums text-muted">
          peak {Math.round(aegis.peakBytes / 1024)} KB · {aegis.findings.length} flags
        </p>
      </header>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[168px] w-full" role="img" aria-label="Aegis live heap">
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={pad}
            x2={w - pad}
            y1={pad + (innerH * i) / 4}
            y2={pad + (innerH * i) / 4}
            stroke="color-mix(in oklab, var(--color-primary) 10%, transparent)"
          />
        ))}
        {area ? <path d={area} fill={fill} /> : null}
        {pts.length > 1 ? <path d={linePath(pts)} fill="none" stroke={stroke} strokeWidth="1.5" /> : null}
        <text x={pad} y={14} fill="var(--color-subtle)" fontSize="10" fontFamily="ui-monospace, SF Mono, monospace">
          {Math.round(aegis.liveBytes / 1024)} KB live
        </text>
      </svg>
    </section>
  );
}

function StrikerTrace({ striker }: { striker: StrikerState }) {
  const w = 640;
  const h = 168;
  const pad = 12;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const grouped = new Map<number, number[]>();
  for (const s of striker.samples) {
    const arr = grouped.get(s.t) || [];
    arr.push(s.ms);
    grouped.set(s.t, arr);
  }
  const ticks = [...grouped.keys()].sort((a, b) => a - b);
  const avgs = ticks.map((t) => {
    const vals = grouped.get(t) || [0];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  const max = Math.max(40, ...avgs);
  const pts = avgs.map((v, i) => ({
    x: pad + (i / Math.max(1, avgs.length - 1)) * innerW,
    y: pad + innerH - (v / max) * innerH,
  }));
  const hot = striker.p99 > 120;
  const stroke = hot ? "var(--color-warn)" : "var(--color-primary)";
  const barW = Math.max(2, innerW / striker.workers - 4);

  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Striker · concurrency</h2>
        <p className="font-mono text-xs tabular-nums text-muted">
          p50 {striker.p50} · p95 {striker.p95} · drop {striker.dropped}
        </p>
      </header>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[168px] w-full" role="img" aria-label="Striker latency">
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={pad}
            x2={w - pad}
            y1={pad + (innerH * i) / 4}
            y2={pad + (innerH * i) / 4}
            stroke="color-mix(in oklab, var(--color-primary) 10%, transparent)"
          />
        ))}
        {pts.length > 1 ? <path d={linePath(pts)} fill="none" stroke={stroke} strokeWidth="1.5" /> : null}
        {Array.from({ length: striker.workers }, (_, i) => {
          const busy = i < striker.inflight;
          const bh = busy ? innerH * 0.18 : innerH * 0.06;
          const x = pad + i * (innerW / striker.workers);
          return (
            <rect
              key={i}
              x={x}
              y={pad + innerH - bh}
              width={barW}
              height={bh}
              fill={busy ? "var(--color-primary)" : "color-mix(in oklab, var(--color-fg) 12%, transparent)"}
            />
          );
        })}
        <text x={pad} y={14} fill="var(--color-subtle)" fontSize="10" fontFamily="ui-monospace, SF Mono, monospace">
          p99 {striker.p99} ms
        </text>
      </svg>
    </section>
  );
}

export function DualTraces({ aegis, striker }: { aegis: AegisState; striker: StrikerState }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <AegisTrace aegis={aegis} />
      <StrikerTrace striker={striker} />
    </div>
  );
}
