-- Track when the send worker actually began the gmail.users.messages.send
-- call. The send-job lock plus this column close the gap between the
-- pre-send idempotency check and the actual Gmail API call: if a sibling
-- worker sees status='sending' and sending_started_at within the active
-- window, it releases the lock without re-sending.

alter table public.email_messages
  add column if not exists sending_started_at timestamptz;

create index if not exists email_messages_sending_idx
  on public.email_messages(sending_started_at)
  where status = 'sending';
