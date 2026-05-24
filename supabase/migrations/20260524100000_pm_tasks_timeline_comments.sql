-- Task timeline (start_date) + comments thread.

alter table public.pm_tasks
  add column if not exists start_date date;

create index if not exists pm_tasks_start_idx on public.pm_tasks(start_date) where start_date is not null;
create index if not exists pm_tasks_due_idx on public.pm_tasks(due_date) where due_date is not null;

create table if not exists public.pm_task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default 'a0000000-0000-0000-0000-000000000001'::uuid,
  task_id uuid not null references public.pm_tasks(id) on delete cascade,
  author_team_member_id uuid references public.hr_team_members(id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pm_task_comments_task_idx
  on public.pm_task_comments(task_id, created_at desc);

drop trigger if exists pm_task_comments_touch on public.pm_task_comments;
create trigger pm_task_comments_touch before update on public.pm_task_comments
  for each row execute function public.touch_pm_updated_at();

alter publication supabase_realtime add table public.pm_task_comments;

alter table public.pm_task_comments enable row level security;
drop policy if exists "pm_task_comments org access" on public.pm_task_comments;
create policy "pm_task_comments org access" on public.pm_task_comments for all using (true) with check (true);
