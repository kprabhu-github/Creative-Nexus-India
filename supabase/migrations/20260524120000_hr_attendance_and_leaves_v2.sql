-- Attendance daily log (one row per team member per day) + leaves v2.
-- Leaves migration is additive — new code uses team_member_id while the
-- legacy employee_id column stays for backfill scripts.

create table if not exists public.hr_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default 'a0000000-0000-0000-0000-000000000001'::uuid,
  team_member_id uuid not null references public.hr_team_members(id) on delete cascade,
  user_id uuid,
  log_date date not null default current_date,
  status text not null default 'present'
    check (status in ('present','wfh','meeting','away','sick','absent','leave')),
  checked_in_at timestamptz not null default now(),
  last_status_change_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  geo_lat numeric,
  geo_lng numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, team_member_id, log_date)
);

create index if not exists hr_attendance_logs_member_date_idx
  on public.hr_attendance_logs(team_member_id, log_date desc);
create index if not exists hr_attendance_logs_date_idx
  on public.hr_attendance_logs(log_date desc);

create or replace function public.touch_hr_attendance_logs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists hr_attendance_logs_touch on public.hr_attendance_logs;
create trigger hr_attendance_logs_touch before update on public.hr_attendance_logs
  for each row execute function public.touch_hr_attendance_logs_updated_at();

alter table public.hr_attendance_logs enable row level security;
drop policy if exists "hr_attendance_logs org access" on public.hr_attendance_logs;
create policy "hr_attendance_logs org access" on public.hr_attendance_logs
  for all using (true) with check (true);

alter publication supabase_realtime add table public.hr_attendance_logs;

alter table public.hr_leaves
  add column if not exists team_member_id uuid references public.hr_team_members(id) on delete cascade,
  add column if not exists half_day boolean not null default false,
  add column if not exists half_day_session text check (half_day_session in ('AM','PM')),
  add column if not exists urgency text not null default 'normal' check (urgency in ('normal','urgent','emergency')),
  add column if not exists attachment_url text,
  add column if not exists decision_notes text,
  add column if not exists decided_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.hr_leaves alter column status set default 'pending';

alter table public.hr_leaves
  drop constraint if exists hr_leaves_status_check;
alter table public.hr_leaves
  add constraint hr_leaves_status_check
  check (status in ('pending','approved','rejected','cancelled'));

alter table public.hr_leaves
  drop constraint if exists hr_leaves_leave_type_check;
alter table public.hr_leaves
  add constraint hr_leaves_leave_type_check
  check (leave_type in ('casual','sick','earned','emergency','unpaid','wfh','other'));

create index if not exists hr_leaves_team_member_idx
  on public.hr_leaves(team_member_id, start_date desc);
create index if not exists hr_leaves_pending_idx
  on public.hr_leaves(status) where status = 'pending';

create or replace function public.touch_hr_leaves_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists hr_leaves_touch on public.hr_leaves;
create trigger hr_leaves_touch before update on public.hr_leaves
  for each row execute function public.touch_hr_leaves_updated_at();

alter table public.hr_leaves enable row level security;
drop policy if exists "hr_leaves org access" on public.hr_leaves;
create policy "hr_leaves org access" on public.hr_leaves
  for all using (true) with check (true);

alter publication supabase_realtime add table public.hr_leaves;
