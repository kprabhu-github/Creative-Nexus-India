-- HR team members directory: backs the /people page.
-- Org-scoped, slug-unique, soft-link to core_users for mailbox holders.

create table if not exists public.hr_team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  slug text not null,
  name text not null,
  title text not null,
  department text,
  role_tag text default 'team' check (role_tag in ('founder','mentor','team','extended','intern','alumni')),
  photo_url text,
  bio text,
  email text,
  phone text,
  linkedin_url text,
  twitter_url text,
  location text,
  skills text[] default '{}',
  joined_at date,
  display_order int default 100,
  status text default 'active' check (status in ('active','inactive','alumni')),
  core_user_id uuid references public.core_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create index if not exists hr_team_members_org_idx on public.hr_team_members(org_id);
create index if not exists hr_team_members_dept_idx on public.hr_team_members(department) where status = 'active';
create index if not exists hr_team_members_role_idx on public.hr_team_members(role_tag);

alter table public.hr_team_members enable row level security;
drop policy if exists "hr_team_members org access" on public.hr_team_members;
create policy "hr_team_members org access" on public.hr_team_members for all using (true) with check (true);

create or replace function public.touch_hr_team_members_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists hr_team_members_touch on public.hr_team_members;
create trigger hr_team_members_touch before update on public.hr_team_members
  for each row execute function public.touch_hr_team_members_updated_at();
