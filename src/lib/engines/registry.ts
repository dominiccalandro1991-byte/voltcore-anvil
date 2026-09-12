export type MapAEngine = { k: number; id: string; role: string };

export const MAP_A: MapAEngine[] = [
  { k: 1, id: "soft-body-physics", role: "Mass-spring; fail on non-finite/exploding state" },
  { k: 2, id: "multi-agent-interaction", role: "Seek+separation; replay-hash, OOB, convergence" },
  { k: 3, id: "tcc-anomaly", role: "Matrix diff + Gaussian smooth + local maxima" },
  { k: 4, id: "cdem-diagnosis", role: "Bayesian posterior + Shannon entropy" },
  { k: 5, id: "rte-repair-plan", role: "Dijkstra on weighted graph; safety gate" },
  { k: 6, id: "tier-drift", role: "Tier / schema drift detector" },
  { k: 7, id: "physics-qc-matrix", role: "QC matrix; 1-D input clean error" },
  { k: 8, id: "dependency-collision", role: "Dependency collision" },
  { k: 9, id: "market-absence-indexer", role: "Market absence index" },
  { k: 10, id: "thermal-dissipation", role: "Thermal dissipation" },
  { k: 11, id: "thermal-gradient", role: "Thermal gradient" },
  { k: 12, id: "thermo-mechanical-stress", role: "Thermo-mechanical stress" },
  { k: 13, id: "vision-surface-defects", role: "Vision surface defects" },
  { k: 14, id: "solder-bridge-inspection", role: "Solder bridge inspection" },
  { k: 15, id: "geometry-tolerance", role: "Geometry tolerance; 1-D → ValidationReport" },
  { k: 16, id: "uv-luminescence", role: "UV luminescence" },
  { k: 17, id: "fluid-viscosity", role: "Fluid viscosity" },
  { k: 18, id: "corrosion-oxidation", role: "Corrosion / oxidation" },
  { k: 19, id: "barometric-pressure", role: "Barometric pressure" },
  { k: 20, id: "causal-fusion", role: "Fuse diagnostic suite outputs" },
  { k: 21, id: "nase-aegis", role: "Five-agent NASE + Tool-Gateway + Policy Governor" },
  { k: 22, id: "nadre-monitor", role: "Self-heal / memory-pressure / debug-repair monitor" },
  { k: 23, id: "usse-stress", role: "Regular stress engine" },
  { k: 24, id: "oiav-vault", role: "IP / copyright vault seal" },
  { k: 25, id: "nnacc", role: "Chat / studio surface validator" },
];

export type MapBEngine = {
  id: number;
  slug: string;
  name: string;
  batch: "research" | "inventor" | "coder" | "deploy" | "ecosystem";
  usesAi?: boolean;
  role: string;
};

export const MAP_B: MapBEngine[] = [
  { id: 1, slug: "ingestion-core", name: "Ingestion Core", batch: "research", role: "Detect kind, route, shard" },
  { id: 2, slug: "heuristic-indexer", name: "Heuristic Indexer", batch: "research", role: "TF-IDF unigrams + bigrams" },
  { id: 3, slug: "prior-art-validator", name: "Prior Art Validator", batch: "research", role: "Jaccard + SHA exact" },
  { id: 4, slug: "anomaly-detector", name: "Anomaly Detector", batch: "research", role: "z and modified-z flags" },
  { id: 5, slug: "aegis-router", name: "Aegis Router", batch: "research", role: "Playbook winner after a run" },
  { id: 6, slug: "kinematic-load", name: "Kinematic Load", batch: "inventor", role: "F=ma kinematics" },
  { id: 7, slug: "terrain-analyzer", name: "Terrain Analyzer", batch: "inventor", role: "Friction / slip / grade" },
  { id: 8, slug: "torque-thermal", name: "Torque Thermal", batch: "inventor", role: "Heat Euler integration" },
  { id: 9, slug: "structural-validator", name: "Structural Validator", batch: "inventor", role: "Beam SF ≥ 2" },
  { id: 10, slug: "market-indexer", name: "Market Indexer", batch: "inventor", role: "HHI concentration" },
  { id: 11, slug: "codegen-orchestrator", name: "CodeGen Orchestrator", batch: "coder", usesAi: true, role: "grok-4.5 spec → code" },
  { id: 12, slug: "ast-parser", name: "AST Parser", batch: "coder", role: "Acorn-less brace walk" },
  { id: 13, slug: "syntax-logic-validator", name: "Syntax Logic Validator", batch: "coder", role: "Static rule walk" },
  { id: 14, slug: "refactor-engine", name: "Refactor Engine", batch: "coder", role: "Deterministic rewrite + LCS" },
  { id: 15, slug: "test-harness", name: "Test Harness", batch: "coder", role: "run(input) cases" },
  { id: 16, slug: "target-node-selector", name: "Target Node Selector", batch: "deploy", role: "Live probe max 8" },
  { id: 17, slug: "edge-latency-matrix", name: "Edge Latency Matrix", batch: "deploy", role: "Rank origins by RTT" },
  { id: 18, slug: "commit-orchestrator", name: "Commit Orchestrator", batch: "deploy", role: "Conventional type from LCS" },
  { id: 19, slug: "mobile-viewport-attestation", name: "Mobile Viewport Attestation", batch: "deploy", role: "390×844 checks" },
  { id: 20, slug: "production-build-compiler", name: "Production Build Compiler", batch: "deploy", role: "Strip + secret scan" },
  { id: 21, slug: "causalrail", name: "CausalRail", batch: "ecosystem", role: "Normalize + cluster traces" },
  { id: 22, slug: "proofpatch", name: "ProofPatch", batch: "ecosystem", usesAi: true, role: "LLM unified diff only" },
  { id: 23, slug: "incidentdojo", name: "IncidentDojo", batch: "ecosystem", role: "Jaccard runbooks" },
  { id: 24, slug: "scopeshield", name: "ScopeShield", batch: "ecosystem", role: "Secret regex + redact" },
  { id: 25, slug: "keyharbor", name: "KeyHarbor", batch: "ecosystem", role: "Token bucket limiter" },
];
