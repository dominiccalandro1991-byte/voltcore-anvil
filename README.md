# VOLTCORE ANVIL

Signed-in dual-engine stress command center. Composes frozen **USSE** (physical / digital / unified fusion, NASE Δt = 30 s, fail at 0.85), **VSTE** (four vectors: `monte_carlo_fuzz` N=800, complexity {10,100,1000}, memory 48×256 KiB, `fault_injection`), and Map B **live HTTP** (SSRF deny, 5 s, max 8, HEAD→GET) into a bounded load loop (≤50 VU, ≤120 s, ≤1000 req, KeyHarbor).

Live: [github.com/dominiccalandro1991-byte/voltcore-anvil](https://github.com/dominiccalandro1991-byte/voltcore-anvil)

## Modes

| Mode | Engine | What it proves |
|---|---|---|
| physical / digital / unified | USSE | Torque, bending, utilization, digital pressure, fused risk |
| live | probe-live | Status, RTT, error rate on operator-owned public URLs |
| virtual | VSTE | Fuzz, complexity, heap, named fault probes |
| hybrid | VSTE 1–3 + subsample | In-process vectors plus ≤8 live probes |

## Surfaces

- **Command** — mode picker, ownership attestation, gauges, live ticks
- **Labs** — Map B ENG-01…25 instruments (not 25 load generators)
- **Attest** — Map C φ-vector, ω_k = 1/25, `S_attest`
- **History** — last 40 runs, Markdown / JSON export
- **Console** — operator chat; USSE intents run locally; grok-4.5 capped at 8
- **Settings** — KeyHarbor C/R, safety copy, no Stripe, no heal

## Safety

- Ownership attestation required and persisted
- SSRF deny: localhost, RFC1918, link-local, `.local`, `.internal`
- Live caps: 50 VU / 120 s / 1000 requests / linear ramp
- No `/heal`, no trunk write, no secrets in git
- One database: Neon (PGLite fallback in preview). Not Supabase.

## Stack

TanStack Start, React 19, Tailwind v4, Better Auth (Google + X via Grok broker), Neon Postgres.

Auth is required. Every server function uses `authMiddleware`. Queries are scoped to `context.userId`.

## Verify

```text
USSE 400 lb × 0.3 m lever → mass_kg ∈ (180, 185)
High utilization + digital pressure → failure_risk ≥ 0.85 → failed
http://127.0.0.1 rejected by SSRF
```
