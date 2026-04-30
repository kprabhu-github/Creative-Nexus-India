-- ─────────────────────────────────────────────────────────────────────────
-- Email Integration: per-account SMTP+IMAP credentials, threads, messages.
-- Every row scoped to org_id; RLS on, single-tenant in practice (Track 1).
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── email_accounts ────────────────────────────────────────────────────────
create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text not null,
  display_name text not null,
  smtp_host text not null default 'smtp.gmail.com',
  smtp_port int not null default 465,
  imap_host text not null default 'imap.gmail.com',
  imap_port int not null default 993,
  app_password_encrypted text not null,
  status text not null default 'connected'
    check (status in ('connected','failed','disconnected')),
  last_sync_at timestamptz,
  last_sync_uid bigint,
  last_error text,
  org_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists email_accounts_org_idx on public.email_accounts(org_id);
create index if not exists email_accounts_status_idx on public.email_accounts(status) where status = 'connected';

-- ── email_threads ─────────────────────────────────────────────────────────
create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  subject text,
  participants text[] not null default '{}',
  last_message_at timestamptz,
  message_count int not null default 0,
  unread_count int not null default 0,
  lead_id uuid null,
  org_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists email_threads_account_idx on public.email_threads(account_id, last_message_at desc);
create index if not exists email_threads_lead_idx on public.email_threads(lead_id) where lead_id is not null;
create index if not exists email_threads_org_idx on public.email_threads(org_id);

-- ── email_messages ────────────────────────────────────────────────────────
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  imap_uid bigint,
  message_id text,
  in_reply_to text,
  references_chain text[] not null default '{}',
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  snippet text,
  direction text not null check (direction in ('inbound','outbound')),
  is_read boolean not null default false,
  sent_at timestamptz,
  org_id uuid not null,
  created_at timestamptz not null default now(),
  unique (account_id, imap_uid)
);

create index if not exists email_messages_thread_idx on public.email_messages(thread_id, sent_at desc);
create index if not exists email_messages_message_id_idx on public.email_messages(message_id) where message_id is not null;
create index if not exists email_messages_org_idx on public.email_messages(org_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.email_accounts enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;

-- Permissive policies for the seeded org (single-tenant); tighten in Track 2.
drop policy if exists "email_accounts org access" on public.email_accounts;
create policy "email_accounts org access" on public.email_accounts
  for all using (true) with check (true);

drop policy if exists "email_threads org access" on public.email_threads;
create policy "email_threads org access" on public.email_threads
  for all using (true) with check (true);

drop policy if exists "email_messages org access" on public.email_messages;
create policy "email_messages org access" on public.email_messages
  for all using (true) with check (true);

-- ── updated_at trigger ────────────────────────────────────────────────────
create or replace function public.touch_email_accounts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists email_accounts_touch on public.email_accounts;
create trigger email_accounts_touch
  before update on public.email_accounts
  for each row execute function public.touch_email_accounts_updated_at();
