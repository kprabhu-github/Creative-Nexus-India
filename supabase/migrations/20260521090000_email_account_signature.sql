-- Per-account email signature. Appended on new compose (not replies, since
-- the parent quoted block already contains the signature from the previous send).

alter table public.email_accounts
  add column if not exists signature_html text;

comment on column public.email_accounts.signature_html is
  'HTML signature appended to outbound messages when composing new emails. NULL means no signature.';
