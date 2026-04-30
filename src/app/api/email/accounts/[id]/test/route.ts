// POST /api/email/accounts/[id]/test — re-verify SMTP + IMAP with stored creds

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySmtp } from "@/lib/email/smtp";
import { verifyImap } from "@/lib/email/imap";
import type { EmailAccount } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();
  const { data: account, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const acc = account as EmailAccount;

  try {
    await verifySmtp(acc);
    await verifyImap(acc);
    await supabase
      .from("email_accounts")
      .update({ status: "connected", last_error: null })
      .eq("id", params.id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verify failed";
    await supabase
      .from("email_accounts")
      .update({ status: "failed", last_error: msg })
      .eq("id", params.id);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
