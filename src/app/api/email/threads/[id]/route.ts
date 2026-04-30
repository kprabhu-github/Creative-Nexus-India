// GET /api/email/threads/[id] — thread + ordered messages (without bodies)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: thread, error: threadErr } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (threadErr || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: messages, error: msgErr } = await supabase
    .from("email_messages")
    .select("id, account_id, imap_uid, message_id, in_reply_to, from_email, to_emails, cc_emails, subject, snippet, direction, is_read, sent_at")
    .eq("thread_id", params.id)
    .order("sent_at", { ascending: true });

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: { thread, messages: messages ?? [] } });
}
