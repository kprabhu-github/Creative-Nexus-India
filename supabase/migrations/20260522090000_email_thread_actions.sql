-- Thread-level user actions: star, archive, soft-delete.
-- Default inbox view filters: archived = false AND trashed_at IS NULL.

alter table public.email_threads
  add column if not exists starred boolean not null default false,
  add column if not exists archived boolean not null default false,
  add column if not exists trashed_at timestamptz;

create index if not exists email_threads_starred_idx
  on public.email_threads(starred) where starred = true;

create index if not exists email_threads_archived_idx
  on public.email_threads(archived) where archived = true;

create index if not exists email_threads_trashed_idx
  on public.email_threads(trashed_at) where trashed_at is not null;

comment on column public.email_threads.starred is
  'User-flagged thread. Surfaces in Starred filter; visible in default Inbox.';
comment on column public.email_threads.archived is
  'Thread hidden from default Inbox but retained. Surfaces in Archived filter.';
comment on column public.email_threads.trashed_at is
  'Soft-delete timestamp. NULL = active; set = in Trash. Permanent delete is a separate cleanup job.';
