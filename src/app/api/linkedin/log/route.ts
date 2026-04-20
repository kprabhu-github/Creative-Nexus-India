// ---------------------------------------------------------------------------
// GET /api/linkedin/log — most recent activity log entries
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("linkedin_activity_log")
    .select("id,account_id,message,type,created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load log: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
