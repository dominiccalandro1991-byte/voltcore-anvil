import type { FleetSpec } from "./types.ts";

export const DEPRECATED_LANES = ["asml-nexus", "VOLTCORE-IdeaForge"] as const;

/** Phosphor 31-lane lattice. Source keys match Worker LATTICE. */
export const FLEET: Record<string, FleetSpec> = {
  "core-api": {
    repo: "dominiccalandro1991-byte/core-api",
    paths: ["src/"],
    group: "trunk",
    groupLabel: "Dual-Rail Trunk",
    rail: "trunk",
  },
  "storm-path": {
    repo: "voltcore-org/storm-path",
    paths: ["telemetry.js", "index.html"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "storm-path-web": {
    repo: "voltcore-org/storm-path-web",
    paths: ["telemetry.js"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "storm-path-mobile": {
    repo: "voltcore-org/storm-path-mobile",
    paths: ["src/"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "storm-path-app": {
    repo: "dominiccalandro1991-byte/storm-path-app",
    paths: ["src/"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "nano-sandbox": {
    repo: "voltcore-org/nano-sandbox",
    paths: ["backend/app/", "public/"],
    group: "nano",
    groupLabel: "Nano Mesh",
    rail: "edge",
  },
  "snca-codec": {
    repo: "voltcore-org/snca-codec",
    paths: ["src/"],
    group: "nano",
    groupLabel: "Nano Mesh",
    rail: "edge",
  },
  "nano-cloud": {
    repo: "voltcore-org/snca-codec",
    paths: ["src/"],
    group: "nano",
    groupLabel: "Nano Mesh",
    rail: "edge",
  },
  "voltcore-command-center": {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["app.js", "index.html"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "command_center.remediate": {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["app.js"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "grok-orchestration-engine": {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["app.js"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  monday: {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "voltcore-code-agent": {
    repo: "dominiccalandro1991-byte/voltcore-code-agent",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "voltcore-anvil": {
    repo: "dominiccalandro1991-byte/voltcore-anvil",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "voltcore-phosphor": {
    repo: "dominiccalandro1991-byte/voltcore-phosphor",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  trueturn: {
    repo: "dominiccalandro1991-byte/TrueTurn",
    paths: ["src/", "public/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  aetherion: {
    repo: "voltcore-org/Aetherion",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "voltcore-asml": {
    repo: "voltcore-org/voltcore-asml",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "conways-game-of-life": {
    repo: "voltcore-org/conways-game-of-life",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "paleochron-arrowforge": {
    repo: "voltcore-org/paleochron-arrowforge",
    paths: ["src/", "index.html", "voltcore/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "vc010-five-artists-engine": {
    repo: "voltcore-org/vc010-five-artists-engine",
    paths: ["index.html"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  causalrail: {
    repo: "voltcore-org/causalrail",
    paths: ["client/", "server/", "voltcore/", "package.json"],
    group: "ops",
    groupLabel: "Ops",
    rail: "edge",
  },
  "orbit-life-operator": {
    repo: "dominiccalandro1991-byte/orbit-life-operator",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "product",
  },
  "apexline-revenue-dashboard": {
    repo: "dominiccalandro1991-byte/apexline-revenue-dashboard",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "product",
  },
  "leadmorph-engine": {
    repo: "dominiccalandro1991-byte/leadmorph-engine",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "product",
  },
  "daily-ignition": {
    repo: "dominiccalandro1991-byte/daily-ignition",
    paths: ["index.html"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "daily-ignition-sober-stack": {
    repo: "dominiccalandro1991-byte/daily-ignition-sober-stack",
    paths: ["index.html"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  lumenarchive: {
    repo: "dominiccalandro1991-byte/lumenarchive",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "lumen-archive-core": {
    repo: "dominiccalandro1991-byte/lumen-archive-core",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "lovable-engine-core": {
    repo: "dominiccalandro1991-byte/lovable-engine-core",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "kite-zest-acre-fjord": {
    repo: "dominiccalandro1991-byte/kite-zest-acre-fjord",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "edge",
  },
};

export const FLEET_GROUPS = [
  { id: "trunk", label: "Dual-Rail Trunk", sources: ["core-api"] },
  {
    id: "storm",
    label: "Storm Path",
    sources: ["storm-path", "storm-path-web", "storm-path-mobile", "storm-path-app"],
  },
  { id: "nano", label: "Nano Mesh", sources: ["nano-sandbox", "snca-codec", "nano-cloud"] },
  {
    id: "command",
    label: "Command",
    sources: [
      "voltcore-command-center",
      "command_center.remediate",
      "grok-orchestration-engine",
      "monday",
      "voltcore-code-agent",
      "voltcore-anvil",
      "voltcore-phosphor",
    ],
  },
  {
    id: "kinetic",
    label: "Kinetic",
    sources: ["trueturn", "aetherion", "voltcore-asml", "conways-game-of-life", "paleochron-arrowforge"],
  },
  {
    id: "ops",
    label: "Ops",
    sources: [
      "causalrail",
      "orbit-life-operator",
      "apexline-revenue-dashboard",
      "leadmorph-engine",
      "kite-zest-acre-fjord",
    ],
  },
  {
    id: "studio",
    label: "Studio",
    sources: [
      "vc010-five-artists-engine",
      "daily-ignition",
      "daily-ignition-sober-stack",
      "lumenarchive",
      "lumen-archive-core",
      "lovable-engine-core",
    ],
  },
] as const;

export const LANE_CEILING = Object.keys(FLEET).length;
export const ANVIL_SOURCE = "voltcore-anvil";
export const TRUNK_ORIGIN = "https://core-api.dominic-calandro1991.workers.dev";
export const FORBID = /(\.env($|\.)|secrets?\/|credentials|id_rsa|ghp_|service_role|wrangler\.toml)/i;
export const STALE_MS = 3 * 60 * 1000;
export const BEAT_MS = 60_000;
export const POLL_MS = 4_000;
