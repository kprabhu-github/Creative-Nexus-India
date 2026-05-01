-- ---------------------------------------------------------------------------
-- ais_tracked_prompts — daily-rescanned prompts with drop alerts
-- ---------------------------------------------------------------------------
-- Stores prompts the user has marked for automatic daily re-scanning.
-- A scheduled cron job (/api/cron/searchlens-track) re-runs the analysis
-- across all 6 AI platforms once per `frequency_days` and appends a new
-- row into ais_prompt_scores. If the new score drops by more than
-- `drop_alert_threshold` percent vs the previous run, a notification is
-- pushed via core_action_notifications.
-- ---------------------------------------------------------------------------

create table if not exists public.ais_tracked_prompts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  brand_name text not null,
  prompt text not null,
  frequency_days int not null default 1 check (frequency_days >= 1 and frequency_days <= 30),
  last_scanned_at timestamptz,
  last_score int,
  drop_alert_threshold int not null default 15,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, brand_name, prompt)
);

create index if not exists ais_tracked_prompts_org_idx
  on public.ais_tracked_prompts(org_id);

create index if not exists ais_tracked_prompts_due_idx
  on public.ais_tracked_prompts(last_scanned_at)
  where paused = false;

alter table public.ais_tracked_prompts enable row level security;

drop policy if exists "ais_tracked_prompts org access" on public.ais_tracked_prompts;
create policy "ais_tracked_prompts org access" on public.ais_tracked_prompts
  for all using (true) with check (true);

create or replace function public.touch_ais_tracked_prompts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ais_tracked_prompts_touch on public.ais_tracked_prompts;
create trigger ais_tracked_prompts_touch
  before update on public.ais_tracked_prompts
  for each row execute function public.touch_ais_tracked_prompts_updated_at();
