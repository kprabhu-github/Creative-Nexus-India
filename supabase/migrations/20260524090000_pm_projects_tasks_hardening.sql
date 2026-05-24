-- Defense-in-depth org_id default + columns + realtime publication for the
-- /projects management module. Single-tenant default UUID matches the rest
-- of the platform; remove later if multi-tenant lands.

alter table public.pm_projects
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid,
  add column if not exists description text,
  add column if not exists priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  add column if not exists lead_team_member_id uuid references public.hr_team_members(id) on delete set null,
  add column if not exists position int default 0;

alter table public.pm_projects
  drop constraint if exists pm_projects_status_check;
alter table public.pm_projects
  add constraint pm_projects_status_check check (status in ('active','on_hold','completed','archived'));

alter table public.pm_tasks
  alter column org_id set default 'a0000000-0000-0000-0000-000000000001'::uuid,
  add column if not exists description text,
  add column if not exists position int default 0,
  add column if not exists assignee_team_member_id uuid references public.hr_team_members(id) on delete set null;

alter table public.pm_tasks
  drop constraint if exists pm_tasks_status_check;
alter table public.pm_tasks
  add constraint pm_tasks_status_check check (status in ('todo','in_progress','review','done','blocked'));

create index if not exists pm_tasks_project_status_idx on public.pm_tasks(project_id, status, position);
create index if not exists pm_tasks_assignee_idx on public.pm_tasks(assignee_team_member_id) where assignee_team_member_id is not null;
create index if not exists pm_projects_status_idx on public.pm_projects(status, position);

create or replace function public.touch_pm_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists pm_projects_touch on public.pm_projects;
create trigger pm_projects_touch before update on public.pm_projects
  for each row execute function public.touch_pm_updated_at();

drop trigger if exists pm_tasks_touch on public.pm_tasks;
create trigger pm_tasks_touch before update on public.pm_tasks
  for each row execute function public.touch_pm_updated_at();

alter publication supabase_realtime add table public.pm_projects;
alter publication supabase_realtime add table public.pm_tasks;

alter table public.pm_projects enable row level security;
alter table public.pm_tasks enable row level security;
drop policy if exists "pm_projects org access" on public.pm_projects;
create policy "pm_projects org access" on public.pm_projects for all using (true) with check (true);
drop policy if exists "pm_tasks org access" on public.pm_tasks;
create policy "pm_tasks org access" on public.pm_tasks for all using (true) with check (true);
