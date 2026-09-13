import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { listThreads, listMessages, sendConsole } from "@/lib/server/chat";
import type { MessageRow, ThreadRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Md } from "@/components/md";
import { readMeter } from "@/lib/engines/meter";
import { XAI_CAP } from "@/lib/engines/constants";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/console")({ component: Page });

function Page() {
  return (
    <Authed>
      <Console />
    </Authed>
  );
}

const TEMPLATES = [
  "stress 400 lb on a 0.3 m lever, 12 agents",
  "Explain KeyHarbor caps for a live probe of my API",
  "Map C φ vector — what does ω_k = 1/25 mean for S_attest?",
];

function groupLabel(isoStamp: string, now = Date.now()): string {
  const t = new Date(isoStamp).getTime();
  const age = now - t;
  if (age < 86_400_000) return "Today";
  if (age < 7 * 86_400_000) return "Previous 7 days";
  return "Older";
}

function Console() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [tid, setTid] = useState<string | undefined>();
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gen = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const meter = readMeter();

  useEffect(() => {
    void listThreads().then(setThreads).catch(() => setThreads([]));
  }, []);

  useEffect(() => {
    if (!tid) return;
    void listMessages({ data: tid }).then(setMsgs).catch(() => setMsgs([]));
  }, [tid]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const m = new Map<string, ThreadRow[]>();
    for (const t of threads) {
      const g = groupLabel(t.updated_at, now);
      const arr = m.get(g) ?? [];
      arr.push(t);
      m.set(g, arr);
    }
    return [...m.entries()];
  }, [threads]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setErr(null);
    setText("");
    const ticket = ++gen.current;
    try {
      const res = await sendConsole({ data: { threadId: tid, content } });
      if (ticket !== gen.current) return;
      setTid(res.threadId);
      setMsgs((m) => [...m, res.user, res.assistant]);
      const th = await listThreads();
      if (ticket !== gen.current) return;
      setThreads(th);
    } catch (e) {
      if (ticket !== gen.current) return;
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (ticket === gen.current) setBusy(false);
    }
  }

  function stop() {
    gen.current += 1;
    setBusy(false);
  }

  return (
    <div className="h-[calc(100dvh-4.5rem)] md:h-dvh flex flex-col md:flex-row">
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-surface">
        <div className="p-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted">Threads</p>
          <Button
            variant="ghost"
            className="min-h-11 px-3"
            onClick={() => {
              setTid(undefined);
              setMsgs([]);
            }}
          >
            New
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-4 space-y-3">
          {grouped.map(([label, list]) => (
            <div key={label}>
              <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted">
                {label}
              </p>
              <ul className="space-y-1">
                {list.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTid(t.id)}
                      className={
                        "w-full text-left min-h-11 px-3 rounded-sm text-sm truncate " +
                        (tid === t.id ? "bg-raised text-primary" : "text-muted hover:text-fg")
                      }
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-medium">Operator console</h1>
            <p className="text-xs text-muted">
              grok-4.5 · USSE intents local · other prompts capped
            </p>
          </div>
          <p className="text-[11px] font-mono tabular text-muted">
            AI {meter.xai}/{XAI_CAP}
          </p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="text-sm text-muted space-y-2 max-w-lg">
              <p>Try:</p>
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="block text-left text-primary min-h-11"
                  onClick={() => setText(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m) => (
            <article
              key={m.id}
              className={
                "max-w-2xl rounded-md px-3 py-2 " +
                (m.role === "user" ? "ml-auto bg-raised" : "bg-surface border border-border")
              }
            >
              {m.role === "assistant" ? <Md text={m.content} /> : (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              )}
            </article>
          ))}
          {err && <p className="text-sm text-danger">{err}</p>}
          {busy && <p className="text-xs text-muted font-mono">Generating…</p>}
          <div ref={bottom} />
        </div>
        <form
          className="p-3 border-t border-border flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 4000))}
            rows={2}
            placeholder="Command the engines…"
            className="flex-1 rounded-md bg-raised border border-border px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono tabular text-muted">
              {text.length}/4000
            </span>
            <div className="flex gap-2">
              {busy && (
                <Button type="button" variant="ghost" onClick={stop}>
                  Stop
                </Button>
              )}
              <Button type="submit" disabled={busy || !text.trim()}>
                {busy ? "…" : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
