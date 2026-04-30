// POST /api/email/accounts/[id]/sync — manual sync trigger for a single account.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAccount } from "@/lib/email/sync";
import type { EmailAccount } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await syncAccount(data as EmailAccount);
    return NextResponse.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
