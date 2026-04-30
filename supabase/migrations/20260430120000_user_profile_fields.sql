-- Extend core_users with profile fields shown on /profile page.
-- Idempotent: safe to re-run.

alter table public.core_users
  add column if not exists phone text,
  add column if not exists title text,
  add column if not exists department text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists timezone text default 'Asia/Kolkata',
  add column if not exists slack_handle text,
  add column if not exists linkedin_url text;
