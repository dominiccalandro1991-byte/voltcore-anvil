/** Sibling VOLTCORE products. Status probes only — never /heal or trunk write. */
export type FleetBind = "self" | "status" | "jobs-only" | "status-only";

export type FleetNode = {
  id: string;
  name: string;
  role: string;
  repo: string;
  probe: string;
  bind: FleetBind;
};

export const FLEET: FleetNode[] = [
  {
    id: "anvil",
    name: "VOLTCORE ANVIL",
    role: "Signed-in dual-engine stress command",
    repo: "https://github.com/dominiccalandro1991-byte/voltcore-anvil",
    probe: "https://voltcore-anvil.vercel.app",
    bind: "self",
  },
  {
    id: "asml",
    name: "ASML Nexus",
    role: "Five-node kinetic arena",
    repo: "https://github.com/dominiccalandro1991-byte/asml-nexus",
    probe: "https://github.com/dominiccalandro1991-byte/asml-nexus",
    bind: "status",
  },
  {
    id: "orbit",
    name: "Orbit Life Operator",
    role: "Planning operator (billing stays in that repo)",
    repo: "https://github.com/dominiccalandro1991-byte/orbit-life-operator",
    probe: "https://github.com/dominiccalandro1991-byte/orbit-life-operator",
    bind: "status",
  },
  {
    id: "core-api",
    name: "core-api",
    role: "HMAC BFF — status only. Heal and AUTONOMOUS_TRUNK denied.",
    repo: "https://github.com/dominiccalandro1991-byte/core-api",
    probe: "https://github.com/dominiccalandro1991-byte/core-api",
    bind: "status-only",
  },
  {
    id: "trueturn",
    name: "TrueTurn",
    role: "Provably-fair dice/card club (virtual tokens, no cash-out)",
    repo: "https://github.com/dominiccalandro1991-byte/TrueTurn",
    probe: "https://github.com/dominiccalandro1991-byte/TrueTurn",
    bind: "status",
  },
  {
    id: "lumen",
    name: "Lumen Archive",
    role: "Local-first storyworld / Canon Bible",
    repo: "https://github.com/dominiccalandro1991-byte/lumen-archive-core",
    probe: "https://github.com/dominiccalandro1991-byte/lumen-archive-core",
    bind: "status",
  },
  {
    id: "nase",
    name: "Nano-Sandbox",
    role: "Isolated jobs connector. /jobs only.",
    repo: "https://github.com/dominiccalandro1991-byte/nano-sandbox",
    probe: "https://nano-sandbox-api.onrender.com",
    bind: "jobs-only",
  },
];
