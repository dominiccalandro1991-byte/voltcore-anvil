# VOLTCORE ANVIL

Signed-in stress command center. Composes frozen **USSE** (physical / digital / unified fusion, NASE Δt = 30 s, fail at 0.85), **VSTE** (four vectors: monte_carlo_fuzz N=800, complexity {10,100,1000}, memory 48×256 KiB, fault_injection), and Map B **live HTTP** (SSRF deny, 5 s, max 8, HEAD→GET) into a bounded load loop (≤50 VU, ≤120 s, ≤1000 req, KeyHarbor).

## Modes

| Mode | Engine | What it proves |
|---|---|---|
| physical / digital / unified | USSE | Torque, bending, utilization, digital pressure, fused risk |
| live | probe-live | Status, RTT, error rate on operator-owned public URLs |
| virtual | VSTE | Fuzz, complexity, heap, named fault probes |
| hybrid | VSTE 1–3 + subsample | In-process vectors plus ≤8 live probes |

## Mesh

Fleet status for sibling repos (ANVIL, ASML Nexus, Orbit, core-api, TrueTurn, Lumen, Nano-Sandbox). NASE isolate runs token / math / JSON / USSE analysis in-process. Remote connector hits `/jobs` only.

## Safety

- Ownership attestation required and persisted
- SSRF deny: localhost, RFC1918, link-local, `.local`, `.internal`
- Live caps: 50 VU / 120 s / 1000 requests / linear ramp
- No `/heal`, no trunk write, no secrets in git
- One database vendor: Neon (PGLite in preview)

## Stack

TanStack Start, Better Auth (Google + X), Neon Postgres (PGLite in preview).

Auth is required. Runs are scoped to `context.userId`.

## Inspection directive (agents)

Before mutating this repository, verify:

1. **core-api** bindings are status / HMAC only — never `/heal` or `AUTONOMOUS_TRUNK`.
2. **voltcore-command-center** is observability, not a write trunk.
3. Database vendor is **Neon**. Do not add Supabase alongside it.
4. Auth is Google + X via the Grok broker. Email/password stays off unless the owner asks.
5. Stripe, CRM, social feeds, GPS maps, and native store shells belong in sibling repos — not this command center.
6. Live HTTP probes require ownership attestation and the SSRF denylist.
