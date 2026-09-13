import { createFileRoute } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Authed } from "@/components/guard";
import { useAnvil } from "@/lib/store";
import { readMeter } from "@/lib/engines/meter";
import { KEYHARBOR_DEFAULT_C, KEYHARBOR_DEFAULT_R } from "@/lib/engines/constants";
import { getPrefs, savePrefs } from "@/lib/server/mesh";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  return (
    <Authed>
      <Settings />
    </Authed>
  );
}

function Settings() {
  const user = useCurrentUser();
  const s = useAnvil();
  const [meter] = useState(() => readMeter());
  const [instructions, setInstructions] = useState("");
  const [webhook, setWebhook] = useState("");
  const [hookOn, setHookOn] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPrefs()
      .then((p) => {
        setInstructions(p.instructions);
        setWebhook(p.webhook_url ?? "");
        setHookOn(p.webhook_enabled);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setBusy(true);
    setNote("");
    try {
      await savePrefs({
        data: {
          instructions,
          webhook_url: webhook || null,
          webhook_enabled: hookOn,
        },
      });
      setNote("Saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Operator</p>
        <h1 className="text-2xl font-medium">Settings</h1>
      </header>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted">Identity</h2>
        <p className="text-sm">{user?.displayName ?? "Operator"}</p>
        <p className="text-xs font-mono text-muted">{user?.primaryEmail}</p>
        <UserButton />
      </section>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted">Console instructions</h2>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value.slice(0, 2000))}
          rows={4}
          placeholder="Persistent operator context for grok-4.5 (not USSE)."
          className="w-full rounded-md bg-raised border border-border px-3 py-2 text-sm"
        />
      </section>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted">Telemetry webhook</h2>
        <p className="text-xs text-muted">
          Public HTTPS only. Monday.com inbound JSON works. Loopback and private hosts
          denied. Fired on USSE fail and Mesh ping.
        </p>
        <label className="flex items-center gap-3 min-h-11 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={hookOn}
            onChange={(e) => setHookOn(e.target.checked)}
          />
          Enable outbound events
        </label>
        <input
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          placeholder="https://…"
          className="w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm font-mono"
        />
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving" : "Save prefs"}
        </Button>
        {note && <p className="text-xs text-muted">{note}</p>}
      </section>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted">KeyHarbor</h2>
        <label className="block text-xs text-muted">
          Capacity (default {KEYHARBOR_DEFAULT_C})
          <input
            type="number"
            value={s.khC}
            onChange={(e) => s.patch({ khC: Number(e.target.value) })}
            className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm"
          />
        </label>
        <label className="block text-xs text-muted">
          Refill / s (default {KEYHARBOR_DEFAULT_R})
          <input
            type="number"
            value={s.khR}
            onChange={(e) => s.patch({ khR: Number(e.target.value) })}
            className="mt-1 w-full min-h-11 rounded-md bg-raised border border-border px-3 text-sm"
          />
        </label>
      </section>
      <section className="rounded-lg bg-surface border border-border p-4 space-y-2 text-sm">
        <h2 className="text-sm uppercase tracking-widest text-muted">Meter</h2>
        <p className="font-mono tabular">ARMED {meter.armed}/25</p>
        <p className="font-mono tabular">RUNS {meter.totalRuns}</p>
        <p className="font-mono tabular">AI {meter.xai}/8</p>
      </section>
      <section className="rounded-lg bg-surface border border-border p-4 text-xs text-muted space-y-1">
        <p>Heal / AUTONOMOUS_TRUNK is out of scope.</p>
        <p>SSRF deny: localhost, RFC1918, link-local, .local, .internal.</p>
        <p>Live caps: 50 VU · 120 s · 1000 requests · linear ramp.</p>
        <p>USSE fail at 0.85. NASE Δt = 30 s. One database: Neon.</p>
        <p>CRM, social feed, GPS maps, Stripe, and native store shells live in sibling repos.</p>
      </section>
    </div>
  );
}
