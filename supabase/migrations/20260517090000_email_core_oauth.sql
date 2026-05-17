-- ─────────────────────────────────────────────────────────────────────────
-- Email Core Phase 1: Gmail OAuth, context engine, send queue.
-- Extends Track 1 schema; preserves IMAP+SMTP path for legacy accounts.
-- ─────────────────────────────────────────────────────────────────────────

-- ── email_accounts: add OAuth columns ────────────────────────────────────
alter table public.email_accounts
  add column if not exists provider text not null default 'smtp_imap'
    check (provider in ('smtp_imap','gmail_oauth')),
  add column if not exists oauth_refresh_token_encrypted text,
  add column if not exists oauth_access_token_encrypted text,
  add column if not exists oauth_expires_at timestamptz,
  add column if not exists oauth_scopes text[] not null default '{}',
  add column if not exists gmail_history_id text,
  add column if not exists gmail_watch_expiration timestamptz,
  add column if not exists is_default boolean not null default false;

-- App-password becomes optional now that OAuth path exists.
alter table public.email_accounts
  alter column app_password_encrypted drop not null;

create index if not exists email_accounts_provider_idx
  on public.email_accounts(provider, status);

-- Only one default per org.
create unique index if not exists email_accounts_one_default_per_org
  on public.email_accounts(org_id)
  where is_default = true;

-- ── email_messages: add Gmail-native + body columns ──────────────────────
alter table public.email_messages
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text,
  add column if not exists body_html text,
  add column if not exists body_text text,
  add column if not exists attachments_json jsonb,
  add column if not exists status text not null default 'received'
    check (status in ('received','queued','sending','delivered','failed','bounced')),
  add column if not exists failure_reason text,
  add column if not exists retry_count int not null default 0,
  add column if not exists sent_by_user_id uuid,
  add column if not exists sent_by_agent_id text;

create unique index if not exists email_messages_gmail_msg_unique
  on public.email_messages(account_id, gmail_message_id)
  where gmail_message_id is not null;

create index if not exists email_messages_gmail_thread_idx
  on public.email_messages(gmail_thread_id) where gmail_thread_id is not null;

create index if not exists email_messages_status_idx
  on public.email_messages(status) where status in ('queued','sending');

-- ── email_threads: add Gmail thread mapping ──────────────────────────────
alter table public.email_threads
  add column if not exists gmail_thread_id text,
  add column if not exists snippet text;

create unique index if not exists email_threads_gmail_thread_unique
  on public.email_threads(account_id, gmail_thread_id)
  where gmail_thread_id is not null;

-- ── email_contexts: the brain ────────────────────────────────────────────
create table if not exists public.email_contexts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  context_type text not null
    check (context_type in ('lead','proposal','deal','client','campaign','project','none')),
  context_id uuid,
  link_source text not null default 'auto_domain'
    check (link_source in ('auto_domain','auto_email','auto_subject','auto_thread','manual','ai_inferred')),
  confidence numeric(3,2) not null default 1.0,
  org_id uuid not null,
  created_at timestamptz not null default now(),
  unique (message_id, context_type, context_id)
);

create index if not exists email_contexts_lookup_idx
  on public.email_contexts(context_type, context_id);
create index if not exists email_contexts_thread_idx
  on public.email_contexts(thread_id);
create index if not exists email_contexts_org_idx
  on public.email_contexts(org_id);

alter table public.email_contexts enable row level security;
drop policy if exists "email_contexts org access" on public.email_contexts;
create policy "email_contexts org access" on public.email_contexts
  for all using (true) with check (true);

-- ── email_idempotency_keys ───────────────────────────────────────────────
create table if not exists public.email_idempotency_keys (
  key text primary key,
  user_id uuid,
  response_body jsonb not null,
  org_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists email_idempotency_created_idx
  on public.email_idempotency_keys(created_at);

alter table public.email_idempotency_keys enable row level security;
drop policy if exists "email_idempotency org access" on public.email_idempotency_keys;
create policy "email_idempotency org access" on public.email_idempotency_keys
  for all using (true) with check (true);

-- ── email_send_jobs: lightweight DB queue ────────────────────────────────
create table if not exists public.email_send_jobs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_messages(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','locked','done','failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  run_after timestamptz not null default now(),
  org_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_send_jobs_pending_idx
  on public.email_send_jobs(status, run_after) where status = 'pending';
create index if not exists email_send_jobs_locked_idx
  on public.email_send_jobs(status, locked_at) where status = 'locked';

alter table public.email_send_jobs enable row level security;
drop policy if exists "email_send_jobs org access" on public.email_send_jobs;
create policy "email_send_jobs org access" on public.email_send_jobs
  for all using (true) with check (true);

-- ── Realtime: enable on tables the UI subscribes to ──────────────────────
alter publication supabase_realtime add table public.email_messages;
alter publication supabase_realtime add table public.email_threads;
alter publication supabase_realtime add table public.email_contexts;
