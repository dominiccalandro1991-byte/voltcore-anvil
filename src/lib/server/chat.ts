import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { iso } from "@/lib/utils";
import type { MessageRow, ThreadRow } from "@/lib/types";
import { parseSpec, USSE_INTENT, runUsse, emptyPayload } from "@/lib/engines/usse";
import { XAI_CAP } from "@/lib/engines/constants";
import { isHealDenied } from "@/lib/engines/isolate";

const xaiByUser = new Map<string, number>();

function asThread(r: Record<string, unknown>): ThreadRow {
  return {
    id: String(r.id),
    title: String(r.title),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function asMsg(r: Record<string, unknown>): MessageRow {
  return {
    id: String(r.id),
    thread_id: String(r.thread_id),
    role: r.role as MessageRow["role"],
    content: String(r.content),
    created_at: iso(r.created_at),
  };
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_threads where user_id = ${context.userId}
      order by updated_at desc limit 40
    `;
    return rows.map(asThread);
  });

export const listMessages = createServerFn({ method: "GET" })
  .validator((threadId: string) => threadId)
  .middleware([authMiddleware])
  .handler(async ({ context, data: threadId }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from anvil_messages
      where thread_id = ${threadId} and user_id = ${context.userId}
      order by created_at asc
    `;
    return rows.map(asMsg);
  });

export const sendConsole = createServerFn({ method: "POST" })
  .validator((input: { threadId?: string; content: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (isHealDenied(data.content)) {
      throw new Error("heal/trunk denied");
    }
    const sql = await getSql();
    let threadId = data.threadId;
    if (!threadId) {
      threadId = crypto.randomUUID();
      const title = data.content.slice(0, 48) || "untitled";
      await sql`
        insert into anvil_threads (id, user_id, title)
        values (${threadId}, ${context.userId}, ${title})
      `;
    } else {
      const owned = await sql<{ id: string }>`
        select id from anvil_threads where id = ${threadId} and user_id = ${context.userId}
      `;
      if (!owned[0]) throw new Error("thread not found");
    }
    const userMsgId = crypto.randomUUID();
    await sql`
      insert into anvil_messages (id, thread_id, user_id, role, content)
      values (${userMsgId}, ${threadId}, ${context.userId}, ${"user"}, ${data.content})
    `;

    let assistant = "";
    if (USSE_INTENT.test(data.content)) {
      const payload = parseSpec(data.content, "chat-intent");
      payload.mode = "unified";
      payload.attestation_timestamp = Date.now() / 1000;
      if (payload.load_lb === 0 && /stress/i.test(data.content)) {
        payload.load_lb = 400;
        payload.mass_kg = 0;
      }
      const report = runUsse(emptyPayload(payload));
      assistant = [
        `USSE ${payload.mode} — ${report.passed ? "PASSED" : "FAILED"}`,
        `score ${report.score}  failure_risk ${report.fused.failure_risk.toFixed(4)}`,
        `mass_kg ${report.physical.mass_kg.toFixed(4)}  utilization ${report.physical.utilization.toFixed(4)}`,
        `digital_pressure ${report.digital.digital_pressure.toFixed(3)}`,
        report.error ? `error: ${report.error}` : "NASE gate: fresh",
        "Open Command to persist a signed run with the same spec.",
      ].join("\n");
    } else {
      const used = xaiByUser.get(context.userId) ?? 0;
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        assistant =
          "AI console is unavailable in this environment. USSE/VSTE/live engines still run from Command.";
      } else if (used >= XAI_CAP) {
        assistant = `AI cap reached (${XAI_CAP}/browser-equivalent per operator). Use Command to run engines directly.`;
      } else {
        xaiByUser.set(context.userId, used + 1);
        const history = await sql<Record<string, unknown>>`
          select role, content from anvil_messages
          where thread_id = ${threadId} and user_id = ${context.userId}
          order by created_at desc limit 12
        `;
        const prefs = await sql<{ instructions: string }>`
          select instructions from anvil_prefs where user_id = ${context.userId} limit 1
        `;
        const extra = (prefs[0]?.instructions ?? "").slice(0, 800);
        const messages = [
          {
            role: "system",
            content:
              "You are ANVIL Console, operator surface for VOLTCORE ANVIL. Help run USSE (physical/digital/unified), VSTE four vectors, live HTTP probes with SSRF deny, Map B labs, Mesh fleet status, and NASE isolate. Never request secrets. Never suggest attacking third-party origins. Never call /heal or AUTONOMOUS_TRUNK. Caps: 50 VU, 120s, 1000 req. Fail risk 0.85. Be concise, industrial, no emoji." +
              (extra ? ` Operator instructions: ${extra}` : ""),
          },
          ...history
            .reverse()
            .map((m) => ({
              role: String(m.role) === "assistant" ? "assistant" : "user",
              content: String(m.content).slice(0, 2000),
            })),
        ];
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-4.5",
            max_tokens: 700,
            messages,
          }),
        });
        if (!res.ok) {
          assistant = `xAI error ${res.status}`;
        } else {
          const body = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          assistant = body.choices?.[0]?.message?.content ?? "(empty)";
        }
      }
    }

    const asstId = crypto.randomUUID();
    await sql`
      insert into anvil_messages (id, thread_id, user_id, role, content)
      values (${asstId}, ${threadId}, ${context.userId}, ${"assistant"}, ${assistant})
    `;
    await sql`
      update anvil_threads set updated_at = now()
      where id = ${threadId} and user_id = ${context.userId}
    `;
    return {
      threadId,
      user: {
        id: userMsgId,
        thread_id: threadId,
        role: "user" as const,
        content: data.content,
        created_at: new Date().toISOString(),
      },
      assistant: {
        id: asstId,
        thread_id: threadId,
        role: "assistant" as const,
        content: assistant,
        created_at: new Date().toISOString(),
      },
    };
  });
