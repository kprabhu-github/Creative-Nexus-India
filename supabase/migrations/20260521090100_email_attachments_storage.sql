-- Storage bucket for email attachments. Private — every read goes through the
-- send worker (admin client) or signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-attachments',
  'email-attachments',
  false,
  20 * 1024 * 1024, -- 20MB per file (total cap enforced server-side)
  null               -- any mime; the upload route validates
)
on conflict (id) do nothing;

-- Authenticated users can write into their own org prefix; admin client bypasses RLS.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'email_attachments_authenticated_write'
  ) then
    create policy email_attachments_authenticated_write
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'email-attachments');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'email_attachments_authenticated_read'
  ) then
    create policy email_attachments_authenticated_read
      on storage.objects for select
      to authenticated
      using (bucket_id = 'email-attachments');
  end if;
end$$;
