import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { listThreads, listMessages, sendConsole } from "@/lib/server/chat";
import type { MessageRow, ThreadRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/console")({ component: Page });

function Page() {
  return (
    <Authed>
      <Console />
    </Authed>
  );
}

function Console() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [tid, setTid] = useState<string | undefined>();
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

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

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setText("");
    try {
      const res = await sendConsole({ data: { threadId: tid, content } });
      setTid(res.threadId);
      setMsgs((m) => [...m, res.user, res.assistant]);
      const th = await listThreads();
      setThreads(th);
    } finally {
      setBusy(false);
    }
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
        <ul className="flex-1 overflow-auto px-2 pb-4 space-y-1">
          {threads.map((t) => (
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
      </aside>
      <section className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-border">
          <h1 className="text-sm font-medium">Operator console</h1>
          <p className="text-xs text-muted">USSE intents run locally. Other prompts use grok-4.5, capped.</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="text-sm text-muted space-y-2 max-w-lg">
              <p>Try:</p>
              <button
                type="button"
                className="block text-left text-primary"
                onClick={() => setText("stress 400 lb on a 0.3 m lever, 12 agents")}
              >
                stress 400 lb on a 0.3 m lever, 12 agents
              </button>
              <button
                type="button"
                className="block text-left text-primary"
                onClick={() => setText("Explain KeyHarbor caps for a live probe of my API")}
              >
                Explain KeyHarbor caps for a live probe of my API
              </button>
            </div>
          )}
          {msgs.map((m) => (
            <article
              key={m.id}
              className={
                "max-w-2xl rounded-md px-3 py-2 text-sm whitespace-pre-wrap " +
                (m.role === "user" ? "ml-auto bg-raised" : "bg-surface border border-border")
              }
            >
              {m.content}
            </article>
          ))}
          <div ref={bottom} />
        </div>
        <form
          className="p-3 border-t border-border flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
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
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? "…" : "Send"}
          </Button>
        </form>
      </section>
    </div>
  );
}
