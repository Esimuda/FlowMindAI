-- Run this in Supabase SQL Editor to create all tables

-- Workflows
create table if not exists public.workflows (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  blueprint jsonb not null,
  saved_at timestamptz default now(),
  unique(user_id, name)
);
alter table public.workflows enable row level security;
create policy "users manage own workflows" on public.workflows
  for all using (auth.uid() = user_id);

-- Run history
create table if not exists public.run_history (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  run jsonb not null,
  started_at timestamptz default now()
);
alter table public.run_history enable row level security;
create policy "users manage own runs" on public.run_history
  for all using (auth.uid() = user_id);

-- Business profile (one per user)
create table if not exists public.business_profile (
  user_id uuid references auth.users(id) on delete cascade primary key,
  profile jsonb not null,
  saved_at timestamptz default now()
);
alter table public.business_profile enable row level security;
create policy "users manage own profile" on public.business_profile
  for all using (auth.uid() = user_id);

-- Webhooks (one URL per workflow, triggers execution via POST)
create table if not exists public.webhooks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  workflow_name text not null,
  enabled boolean default true,
  trigger_count int default 0,
  last_triggered_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, workflow_name)
);
alter table public.webhooks enable row level security;
create policy "users manage own webhooks" on public.webhooks
  for all using (auth.uid() = user_id);

-- User integration credentials (one row per user, replaces localStorage)
create table if not exists public.user_integrations (
  user_id uuid references auth.users(id) on delete cascade primary key,
  config jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.user_integrations enable row level security;
create policy "users manage own integrations" on public.user_integrations
  for all using (auth.uid() = user_id);

-- Agent memory (short-term, long-term, patterns)
create table if not exists public.agent_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,          -- 'short_term' | 'long_term' | 'pattern'
  key text not null,
  value jsonb not null,
  relevance float default 1.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, type, key)
);
alter table public.agent_memory enable row level security;
create policy "users manage own memory" on public.agent_memory
  for all using (auth.uid() = user_id);

-- Workflow executions (detailed execution tracking with observation + reflection)
create table if not exists public.workflow_executions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  workflow_name text,
  status text not null,        -- 'init' | 'running' | 'success' | 'failed'
  steps jsonb not null default '[]',
  observations jsonb,
  reflection jsonb,
  retry_count int default 0,
  started_at timestamptz default now(),
  completed_at timestamptz
);
alter table public.workflow_executions enable row level security;
create policy "users manage own executions" on public.workflow_executions
  for all using (auth.uid() = user_id);

-- Schedules (server-side, replaces localStorage scheduling)
create table if not exists public.schedules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  workflow_name text not null,
  frequency text not null,     -- 'hourly' | 'daily' | 'weekly'
  last_run timestamptz,
  next_run timestamptz not null,
  enabled boolean default true,
  created_at timestamptz default now(),
  unique(user_id, workflow_name)
);
alter table public.schedules enable row level security;
create policy "users manage own schedules" on public.schedules
  for all using (auth.uid() = user_id);
