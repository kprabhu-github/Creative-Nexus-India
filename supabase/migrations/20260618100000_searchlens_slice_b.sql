-- Slice B: auto-detect + CMS auto-deploy for the SearchLens Fixer.
-- Adds: ais_fix_audit (per-site GEO-readiness probes), ais_cms_connections
-- (encrypted credentials for one-click deploy), and deploy-tracking columns
-- on ais_fix_artifacts.

create table if not exists public.ais_fix_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default 'a0000000-0000-0000-0000-000000000001'::uuid,
  site_url text not null,
  signal text not null check (signal in (
    'llms_txt_present',
    'robots_ai_rules',
    'faq_schema',
    'answer_block',
    'meta_quality'
  )),
  status text not null check (status in ('pass','fail','partial','unknown')),
  details_json jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists ais_fix_audit_site_idx
  on public.ais_fix_audit(site_url, checked_at desc);

alter table public.ais_fix_audit enable row level security;
drop policy if exists "ais_fix_audit org access" on public.ais_fix_audit;
create policy "ais_fix_audit org access" on public.ais_fix_audit
  for all using (true) with check (true);

create table if not exists public.ais_cms_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default 'a0000000-0000-0000-0000-000000000001'::uuid,
  target text not null check (target in ('wordpress','webflow','shopify','custom')),
  site_url text not null,
  label text not null,
  credentials_encrypted text not null,
  meta_json jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ais_cms_connections_site_idx
  on public.ais_cms_connections(site_url);

create or replace function public.touch_ais_cms_connections_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists ais_cms_connections_touch on public.ais_cms_connections;
create trigger ais_cms_connections_touch before update on public.ais_cms_connections
  for each row execute function public.touch_ais_cms_connections_updated_at();

alter table public.ais_cms_connections enable row level security;
drop policy if exists "ais_cms_connections org access" on public.ais_cms_connections;
create policy "ais_cms_connections org access" on public.ais_cms_connections
  for all using (true) with check (true);

alter table public.ais_fix_artifacts
  add column if not exists deployed_at timestamptz,
  add column if not exists deploy_target_url text,
  add column if not exists deploy_status text,
  add column if not exists deploy_connection_id uuid references public.ais_cms_connections(id) on delete set null,
  add column if not exists deploy_error text;

alter publication supabase_realtime add table public.ais_fix_audit;
alter publication supabase_realtime add table public.ais_cms_connections;
