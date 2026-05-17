-- Atomic lock-and-fetch for the send worker.
create or replace function public.lock_email_send_jobs(
  p_worker text,
  p_limit int
)
returns table (
  id uuid,
  message_id uuid,
  account_id uuid,
  attempts int,
  max_attempts int
)
language plpgsql
security definer
as $$
begin
  return query
  with picked as (
    select j.id
    from public.email_send_jobs j
    where j.status = 'pending'
      and j.run_after <= now()
    order by j.created_at
    for update skip locked
    limit p_limit
  )
  update public.email_send_jobs j
     set status = 'locked',
         locked_at = now(),
         locked_by = p_worker,
         updated_at = now()
   from picked
   where j.id = picked.id
  returning j.id, j.message_id, j.account_id, j.attempts, j.max_attempts;
end;
$$;

grant execute on function public.lock_email_send_jobs(text, int) to service_role;
