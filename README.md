# VOLTCORE ANVIL — HammerForge

Mesh hardening forge. Ingest a tree, strip secrets, compile the graph, dual-stress it, pack a Vercel manifest, post the verdict to the Dual-Rail trunk.

Replaces the retired **USSE / VSTE / NASE** command center (`dd94da8`). Auth is off. No secrets in git. No GHA minute crons. Trunk writes are `POST /api/v1/events` only — never `/heal`.

## Pipeline

| Phase | Engine | Big-O | Proof |
|---|---|---|---|
| ingest | hashed bundle + merkle | O(n) | empty merkle is stable |
| strip | FORBID paths + credential scan | O(n) | `.env` / `sk-` / service_role dropped |
| compile | routes, import graph, cycles | O(n+e) | racy fixture flags cycles |
| stress | **Aegis** heap 48 ticks · **Striker** 8-worker queue 48 ticks | O(1)/tick | leaky reject · quench harden |
| score | memory / concurrency / compile / hygiene | O(f) | hardened ≥ 78, reject < 52 |
| pack | Vercel v3 routes + rewrites + headers | O(r) | quench emits hybrid pack |
| sync | `anvil.forge.complete` → core-api | O(1) | HTTP 202 |

Fixtures: **Leaky SPA** (reject), **Racy API** (conditional, concurrency collapse), **Quench SSR** (harden). Paste-tree and file drop also ingest.

## Lattice

31-lane Phosphor lattice. Source key `voltcore-anvil`. Trunk `https://core-api.dominic-calandro1991.workers.dev`. Client 60s heartbeat + 4s lattice poll. Cloudflare Worker cron is the fleet clock — do not re-enable GHA `* * * * *`.

## Tests

```
npm test
```

HammerForge suite (`src/lib/anvil/hammer-forge.test.ts`):

1. lattice ceiling is 31
2. leaky fixture is rejected after dual stress (Aegis + strip)
3. quench fixture hardens (pack + rewrites)
4. racy fixture flags concurrency (Striker race/deadlock)
5. empty bundle merkle is stable

## Safety

- FORBID: `.env`, secrets/, credentials, `id_rsa`, `ghp_`, `service_role`, `wrangler.toml`
- Dual-Rail files untouched. No Dual-Rail secrets on Vercel.
- Mesh POST is public events ingest, HMAC heal is out of scope.

## Stack

TanStack Start, Zustand, localStorage history. No Neon writes. Preview binds `0.0.0.0:8080`.
