import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { iso } from "@/lib/utils";
import { FLEET } from "@/lib/engines/fleet";
import { probeOne } from "@/lib/engines/probe";
import { assertPublicHttpUrl, SsrfError } from "@/lib/engines/ssrf";
import { isHealDenied, runIsolate } from "@/lib/engines/isolate";
import { exportAttestation } from "@/lib/engines/nase";
import type { Json } from "@/lib/types";

export type Prefs = {
  instructions: string;
  webhook_url: string | null;
  webhook_enabled: boolean;
};

export type MeshEvent = {
  id: string;
  kind: string;
  payload: Json;
  delivered: boolean;
  error: string | null;
  created_at: string;
};

export const getPrefs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Prefs> => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select instructions, webhook_url, webhook_enabled
      from anvil_prefs where user_id = ${context.userId} limit 1
    `;
    const r = rows[0];
    return {
      instructions: r ? String(r.instructions ?? "") : "",
      webhook_url: r && r.webhook_url ? String(r.webhook_url) : null,
      webhook_enabled: r ? Boolean(r.webhook_enabled) : false,
    };
  });

export const savePrefs = createServerFn({ method: "POST" })
  .validator((input: Prefs) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    let url: string | null = data.webhook_url?.trim() || null;
    if (url) {
      if (isHealDenied(url)) throw new Error("heal/trunk denied");
      try {
        assertPublicHttpUrl(url);
      } catch (err) {
        throw new Error(err instanceof SsrfError ? err.message : "webhook url denied");
      }
    }
    const sql = await getSql();
    await sql`
      insert into anvil_prefs (user_id, instructions, webhook_url, webhook_enabled, updated_at)
      values (
        ${context.userId},
        ${data.instructions.slice(0, 2000)},
        ${url},
        ${data.webhook_enabled && Boolean(url)},
        now()
      )
      on conflict (user_id) do update set
        instructions = excluded.instructions,
        webhook_url = excluded.webhook_url,
        webhook_enabled = excluded.webhook_enabled,
        updated_at = now()
    `;
    return { ok: true as const };
  });

export const probeFleet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const results = await Promise.all(
      FLEET.map(async (n) => {
        const r = await probeOne(n.probe, { method: "HEAD", timeoutMs: 5000 });
        return {
          id: n.id,
          name: n.name,
          role: n.role,
          repo: n.repo,
          probe: n.probe,
          bind: n.bind,
          ok: r.ok,
          status: r.status,
          ms: r.ms,
          error: r.error,
        };
      }),
    );
    const att = await exportAttestation();
    return { results, s_attest: att.s_attest, weighted_sum: att.weighted_sum };
  });

export const runNaseIsolate = createServerFn({ method: "POST" })
  .validator((input: { source: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    if (isHealDenied(data.source)) {
      return {
        ok: false as const,
        error: "heal/trunk denied",
        report: {
          ok: false,
          kind: "tokens" as const,
          elapsed_ms: 0,
          tokens: [],
          token_count: 0,
          overlap: 0,
          output: { denied: "heal/trunk" },
          s_attest: "",
          error: "heal/trunk denied",
        },
      };
    }
    const report = await runIsolate(data.source);
    return { ok: report.ok, report };
  });

export async function emitMeshEvent(
  userId: string,
  kind: string,
  payload: Json,
): Promise<void> {
  const sql = await getSql();
  const id = crypto.randomUUID();
  const prefs = await sql<Record<string, unknown>>`
    select webhook_url, webhook_enabled from anvil_prefs where user_id = ${userId} limit 1
  `;
  const url = prefs[0]?.webhook_url ? String(prefs[0].webhook_url) : null;
  const enabled = Boolean(prefs[0]?.webhook_enabled) && Boolean(url);
  let delivered = false;
  let error: string | null = null;
  if (enabled && url && !isHealDenied(url)) {
    try {
      assertPublicHttpUrl(url);
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 5000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          source: "voltcore-anvil",
          kind,
          at: new Date().toISOString(),
          payload,
        }),
        signal: ac.signal,
      });
      clearTimeout(t);
      delivered = res.ok;
      if (!res.ok) error = `status ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  await sql`
    insert into anvil_mesh_events (id, user_id, kind, payload, delivered, error)
    values (${id}, ${userId}, ${kind}, ${JSON.stringify(payload)}::jsonb, ${delivered}, ${error})
  `;
}

export const dispatchTelemetry = createServerFn({ method: "POST" })
  .validator((input: { kind: string; note?: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (isHealDenied(data.kind) || isHealDenied(data.note ?? "")) {
      throw new Error("heal/trunk denied");
    }
    const att = await exportAttestation();
    await emitMeshEvent(context.userId, data.kind.slice(0, 40), {
      note: (data.note ?? "").slice(0, 240),
      s_attest: att.s_attest,
      weighted_sum: att.weighted_sum,
    });
    return { ok: true as const, s_attest: att.s_attest };
  });

export const listMeshEvents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select id, kind, payload, delivered, error, created_at
      from anvil_mesh_events
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `;
    return rows.map(
      (r): MeshEvent => ({
        id: String(r.id),
        kind: String(r.kind),
        payload: (typeof r.payload === "string"
          ? (JSON.parse(r.payload) as Json)
          : ((r.payload as Json) ?? {})) as Json,
        delivered: Boolean(r.delivered),
        error: r.error ? String(r.error) : null,
        created_at: iso(r.created_at),
      }),
    );
  });
