/** Minimal markdown: fenced code, inline code, bold. No HTML injection. */
export function Md({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-2 text-sm whitespace-pre-wrap break-words">
      {blocks.map((chunk, i) => {
        if (i % 2 === 1) {
          const nl = chunk.indexOf("\n");
          const body = nl >= 0 ? chunk.slice(nl + 1) : chunk;
          return (
            <pre
              key={i}
              className="overflow-auto max-h-64 rounded-md bg-raised border border-border p-3 font-mono text-xs"
            >
              {body.replace(/\n$/, "")}
            </pre>
          );
        }
        return <Inline key={i} text={chunk} />;
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length >= 2) {
          return (
            <code key={i} className="font-mono text-xs bg-raised px-1 rounded-xs">
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith("**") && p.endsWith("**") && p.length >= 4) {
          return (
            <strong key={i} className="font-medium text-fg">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}
