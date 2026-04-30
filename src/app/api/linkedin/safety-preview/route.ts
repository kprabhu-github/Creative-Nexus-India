// ---------------------------------------------------------------------------
// GET /api/linkedin/safety-preview?account_id&action_key&profile_url
//
// Runs the full safeAction() pipeline WITHOUT performing any action. Used by
// the inbox drawer to show the operator a live preview of which checkpoints
// would pass / warn / fail if they submitted right now.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeAction } from "@/lib/linkedin-safety-pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const accountId = sp.get("account_id");
  const actionKey = sp.get("action_key");
  const profileUrl = sp.get("profile_url");

  if (!actionKey) {
    return NextResponse.json(
      { error: "action_key query param is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const pipeline = await safeAction(supabase, {
    accountId: accountId || null,
    actionKey,
    profileUrl,
  });

  return NextResponse.json({ data: pipeline });
}
