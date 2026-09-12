-- VOLTCORE ANVIL unified telemetry (§7). user_id TEXT; never UUID.
create table if not exists anvil_runs (
  id text primary key,
  user_id text not null,
  mode text not null,
  engine text not null,
  target_frontend text,
  target_backend text,
  authorized boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null,
  vu_count int not null default 0,
  duration_s int not null default 0,
  ramp_s int not null default 0,
  think_ms int not null default 0,
  max_requests int not null default 0,
  requests int not null default 0,
  errors int not null default 0,
  shed_429 int not null default 0,
  rps_peak double precision not null default 0,
  error_rate double precision not null default 0,
  p50_ms double precision,
  p95_ms double precision,
  p99_ms double precision,
  overall_success double precision,
  failure_risk double precision,
  s_attest text,
  weighted_sum double precision,
  attestation_ok boolean not null default true,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists anvil_runs_user_started_idx on anvil_runs (user_id, started_at desc);

create table if not exists anvil_vectors (
  id text primary key,
  run_id text not null,
  user_id text not null,
  vector text not null,
  equation text not null,
  elapsed_ms double precision not null default 0,
  samples int not null default 0,
  failures int not null default 0,
  success_rate double precision not null default 0,
  latency_p50 double precision,
  latency_p95 double precision,
  latency_p99 double precision,
  heap_before jsonb,
  heap_after jsonb,
  series jsonb,
  probes jsonb,
  network_rtt jsonb,
  failure_telemetry jsonb,
  extra jsonb,
  created_at timestamptz not null default now()
);
create index if not exists anvil_vectors_run_idx on anvil_vectors (run_id);

create table if not exists anvil_ticks (
  id text primary key,
  run_id text not null,
  user_id text not null,
  t_ms int not null,
  inflight int not null default 0,
  rps double precision not null default 0,
  error_rate double precision not null default 0,
  p50 double precision,
  p95 double precision,
  p99 double precision,
  ok int not null default 0,
  err int not null default 0,
  shed int not null default 0,
  status_2xx int not null default 0,
  status_3xx int not null default 0,
  status_4xx int not null default 0,
  status_5xx int not null default 0,
  status_0 int not null default 0
);
create index if not exists anvil_ticks_run_t_idx on anvil_ticks (run_id, t_ms);

create table if not exists anvil_threads (
  id text primary key,
  user_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists anvil_threads_user_idx on anvil_threads (user_id, updated_at desc);

create table if not exists anvil_messages (
  id text primary key,
  thread_id text not null,
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists anvil_messages_thread_idx on anvil_messages (thread_id, created_at);
