-- Fix Supabase security advisor: views default to SECURITY DEFINER in PG15+,
-- which means they enforce the creator's permissions and RLS, not the
-- querying user's. Switch both LinkedIn views to security_invoker so RLS
-- is evaluated against the caller as expected.

alter view if exists public.linkedin_campaigns_with_stats
  set (security_invoker = true);

alter view if exists public.linkedin_accounts_health
  set (security_invoker = true);
