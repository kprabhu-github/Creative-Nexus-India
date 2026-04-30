// GET /api/email/messages/[id]/body — fetches full HTML/text body via IMAP on demand.
// Bodies are NOT cached server-side; the client may cache.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBodyByUid } from "@/lib/email/imap";
import type { EmailAccount } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: msg, error: msgErr } = await supabase
    .from("email_messages")
    .select("id, account_id, imap_uid, direction")
    .eq("id", params.id)
    .single();

  if (msgErr || !msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (msg.direction === "outbound" || !msg.imap_uid) {
    return NextResponse.json({ data: { html: null, text: "(outbound — body not stored)" } });
  }

  const { data: account, error: accErr } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", msg.account_id)
    .single();

  if (accErr || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const body = await fetchBodyByUid(account as EmailAccount, msg.imap_uid as number);
    return NextResponse.json({ data: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Body fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
