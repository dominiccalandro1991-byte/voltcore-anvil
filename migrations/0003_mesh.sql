-- Operator prefs + mesh telemetry (per-user). user_id TEXT.
create table if not exists anvil_prefs (
  user_id text primary key,
  instructions text not null default '',
  webhook_url text,
  webhook_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists anvil_mesh_events (
  id text primary key,
  user_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  delivered boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists anvil_mesh_events_user_idx
  on anvil_mesh_events (user_id, created_at desc);
