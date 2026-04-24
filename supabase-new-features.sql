-- ============================================================
-- Operant AI — new features migration
-- Adds: workflow_alerts, custom_tools
-- Run in the Supabase SQL editor.
-- ============================================================

-- ── Workflow alerts ──────────────────────────────────────────

create table if not exists public.workflow_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  workflow_id   text not null,
  workflow_name text not null,
  channel       text not null check (channel in ('email', 'slack')),
  destination   text not null,
  event         text not null check (event in ('failure', 'success', 'all')),
  enabled       boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS
alter table public.workflow_alerts enable row level security;

create policy "Users manage own alerts"
  on public.workflow_alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Custom tools ─────────────────────────────────────────────

create table if not exists public.custom_tools (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text not null,
  http_url    text not null,
  http_method text not null check (http_method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  headers     jsonb not null default '{}',
  params      jsonb not null default '[]',
  enabled     boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, name)
);

-- RLS
alter table public.custom_tools enable row level security;

create policy "Users manage own custom tools"
  on public.custom_tools
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Index for performance ────────────────────────────────────

create index if not exists workflow_alerts_user_workflow_idx
  on public.workflow_alerts (user_id, workflow_id);

create index if not exists custom_tools_user_idx
  on public.custom_tools (user_id, enabled);
