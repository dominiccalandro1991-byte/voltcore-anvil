import { useEffect, useRef, useState } from "react";
import { FIXTURES } from "@/lib/anvil/fixtures";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function FileDrop({ onDrop }: { onDrop: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <Button size="sm" variant="ghost" disabled>
        Drop files
      </Button>
    );
  }
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
        Drop files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onDrop(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function IngestPanel({
  fixtureId,
  paste,
  fileCount,
  bytes,
  merkle,
  onFixture,
  onPasteChange,
  onPasteLoad,
  onDrop,
}: {
  fixtureId: string;
  paste: string;
  fileCount: number;
  bytes: number;
  merkle: string | null;
  onFixture: (id: string) => void;
  onPasteChange: (v: string) => void;
  onPasteLoad: () => void;
  onDrop: (files: FileList) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <header className="mb-3">
        <h2 className="text-sm font-medium tracking-tight">Ingest</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          {fileCount} files · {bytes} B{merkle ? ` · ${merkle}` : ""}
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {FIXTURES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFixture(f.id)}
            className={cn(
              "min-h-11 rounded-full border px-3 text-left text-xs transition-[border-color,background-color] duration-150",
              fixtureId === f.id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-bg text-muted hover:text-fg",
            )}
          >
            <span className="block font-medium">{f.label}</span>
            <span className="block text-[10px] text-subtle">{f.hint}</span>
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
          Paste tree
        </span>
        <textarea
          value={paste}
          onChange={(e) => onPasteChange(e.target.value)}
          placeholder={"src/app.ts\n---\nexport const n = 1\n===\npackage.json\n---\n{ \"name\": \"raw\" }"}
          suppressHydrationWarning
          className="h-28 w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onPasteLoad}>
          Compile paste
        </Button>
        <FileDrop onDrop={onDrop} />
      </div>
    </section>
  );
}
