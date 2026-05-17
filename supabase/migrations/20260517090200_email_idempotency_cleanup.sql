-- Idempotency keys never need to live past a few days. A Hostinger cron or
-- pg_cron job calls this function periodically to keep the table bounded.

create or replace function public.cleanup_email_idempotency_keys(
  p_max_age interval default interval '7 days'
)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int;
begin
  delete from public.email_idempotency_keys
   where created_at < now() - p_max_age;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_email_idempotency_keys(interval) to service_role;
