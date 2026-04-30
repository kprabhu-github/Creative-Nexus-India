// GET /api/email/threads — list threads, optionally filtered by account_id

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("account_id");
  const search = request.nextUrl.searchParams.get("q");
  const supabase = createAdminClient();

  let query = supabase
    .from("email_threads")
    .select("id, account_id, subject, participants, last_message_at, message_count, unread_count, lead_id")
    .eq("org_id", ORG_ID)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (accountId) query = query.eq("account_id", accountId);
  if (search) query = query.ilike("subject", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { threads: data ?? [] } });
}
