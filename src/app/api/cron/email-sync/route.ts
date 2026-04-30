// GET /api/cron/email-sync — runs every 2 min via Hostinger cron.
// Iterates connected accounts and syncs each.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAccount } from "@/lib/email/sync";
import { ORG_ID, type EmailAccount } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const token = process.env.CRON_SECRET;
  if (!token) return true; // no secret set → allow (dev only)
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${token}` || request.nextUrl.searchParams.get("secret") === token;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("status", "connected");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const acc of (accounts ?? []) as EmailAccount[]) {
    try {
      const r = await syncAccount(acc);
      results.push(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync threw";
      results.push({ account_id: acc.id, email: acc.email, fetched: 0, newThreads: 0, newMessages: 0, error: msg });
    }
  }

  return NextResponse.json({
    data: { synced_at: new Date().toISOString(), results },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
