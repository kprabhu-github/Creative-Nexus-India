// ---------------------------------------------------------------------------
// Server-side Supabase admin client — uses SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------
// This client bypasses RLS. Use only in server-side API routes and
// background jobs where the caller has already been authenticated
// and authorised.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Create (or return cached) Supabase admin client that uses the service role
 * key. This client bypasses Row Level Security — use with caution.
 *
 * Only call from server-side code (API routes, server actions, etc.).
 */
export function createAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
