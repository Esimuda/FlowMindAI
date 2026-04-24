-- ============================================================
-- FlowMind AI — complete Supabase schema
-- Copy-paste the entire file into the Supabase SQL editor and run it.
-- All statements use IF NOT EXISTS / ON CONFLICT so re-running is safe.
-- ============================================================


-- ── Workflows ─────────────────────────────────────────────────────────────────
create table if not exists public.workflows (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  blueprint  jsonb not null,
  saved_at   timestamptz default now(),
  unique(user_id, name)
);
alter table public.workflows enable row level security;
create policy "users manage own workflows" on public.workflows
  for all using (auth.uid() = user_id);


-- ── Run history ───────────────────────────────────────────────────────────────
create table if not exists public.run_history (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  run        jsonb not null,
  started_at timestamptz default now()
);
alter table public.run_history enable row level security;
create policy "users manage own runs" on public.run_history
  for all using (auth.uid() = user_id);


-- ── Business profile (one per user) ──────────────────────────────────────────
create table if not exists public.business_profile (
  user_id  uuid references auth.users(id) on delete cascade primary key,
  profile  jsonb not null,
  saved_at timestamptz default now()
);
alter table public.business_profile enable row level security;
create policy "users manage own profile" on public.business_profile
  for all using (auth.uid() = user_id);


-- ── Webhooks ──────────────────────────────────────────────────────────────────
create table if not exists public.webhooks (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references auth.users(id) on delete cascade not null,
  workflow_name     text not null,
  enabled           boolean default true,
  trigger_count     int default 0,
  last_triggered_at timestamptz,
  created_at        timestamptz default now(),
  unique(user_id, workflow_name)
);
alter table public.webhooks enable row level security;
create policy "users manage own webhooks" on public.webhooks
  for all using (auth.uid() = user_id);


-- ── User integration credentials ─────────────────────────────────────────────
create table if not exists public.user_integrations (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  config     jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.user_integrations enable row level security;
create policy "users manage own integrations" on public.user_integrations
  for all using (auth.uid() = user_id);


-- ── Agent memory ──────────────────────────────────────────────────────────────
create table if not exists public.agent_memory (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null,   -- 'short_term' | 'long_term' | 'pattern'
  key        text not null,
  value      jsonb not null,
  relevance  float default 1.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, type, key)
);
alter table public.agent_memory enable row level security;
create policy "users manage own memory" on public.agent_memory
  for all using (auth.uid() = user_id);


-- ── Workflow executions ───────────────────────────────────────────────────────
create table if not exists public.workflow_executions (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  workflow_name text,
  status        text not null,   -- 'init' | 'running' | 'success' | 'failed'
  steps         jsonb not null default '[]',
  observations  jsonb,
  reflection    jsonb,
  retry_count   int default 0,
  started_at    timestamptz default now(),
  completed_at  timestamptz
);
alter table public.workflow_executions enable row level security;
create policy "users manage own executions" on public.workflow_executions
  for all using (auth.uid() = user_id);


-- ── Schedules (server-side cron, replaces localStorage) ──────────────────────
create table if not exists public.schedules (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  workflow_id   text not null,
  workflow_name text not null,
  blueprint     jsonb not null,
  frequency     text not null check (frequency in ('hourly', 'daily', 'weekly')),
  enabled       boolean not null default true,
  last_run_at   timestamptz,
  next_run_at   timestamptz not null,
  created_at    timestamptz not null default now(),
  unique(user_id, workflow_id)
);
alter table public.schedules enable row level security;
create policy "users manage own schedules" on public.schedules
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Service role bypasses RLS — used by the /api/cron/run-schedules handler
create policy "service role manages schedules" on public.schedules
  for all using (auth.role() = 'service_role');


-- ── Subscriptions (Stripe billing) ───────────────────────────────────────────
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  plan                   text not null default 'free',   -- 'free' | 'pro' | 'business'
  status                 text not null default 'active', -- 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "service role manages subscriptions" on public.subscriptions
  for all using (auth.role() = 'service_role');


-- ── Workspaces ────────────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create policy "workspace members can view workspace" on public.workspaces
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = id
        and workspace_members.user_id = auth.uid()
    )
  );
create policy "owners can insert workspaces" on public.workspaces
  for insert with check (auth.uid() = owner_id);
create policy "owners can update workspaces" on public.workspaces
  for update using (auth.uid() = owner_id);
create policy "owners can delete workspaces" on public.workspaces
  for delete using (auth.uid() = owner_id);


-- ── Workspace members ─────────────────────────────────────────────────────────
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'editor', -- 'owner' | 'editor' | 'viewer'
  joined_at    timestamptz not null default now(),
  unique(workspace_id, user_id)
);
alter table public.workspace_members enable row level security;
create policy "members can view workspace members" on public.workspace_members
  for select using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id
        and wm2.user_id = auth.uid()
    )
  );
create policy "owners can manage members" on public.workspace_members
  for all using (
    exists (
      select 1 from public.workspaces
      where workspaces.id = workspace_id
        and workspaces.owner_id = auth.uid()
    )
  );


-- ── Workspace invites ─────────────────────────────────────────────────────────
create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email        text not null,
  role         text not null default 'editor',
  token        text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid references auth.users,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.workspace_invites enable row level security;
create policy "owners manage invites" on public.workspace_invites
  for all using (
    exists (
      select 1 from public.workspaces
      where workspaces.id = workspace_id
        and workspaces.owner_id = auth.uid()
    )
  );
create policy "service role reads invites" on public.workspace_invites
  for select using (auth.role() = 'service_role');
