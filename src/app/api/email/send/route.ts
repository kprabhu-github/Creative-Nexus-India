// POST /api/email/send — first-class send endpoint that also persists
// the outbound message to email_threads/email_messages.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    from_account_id: string;
    to: string;
    cc?: string[];
    subject: string;
    html: string;
    text?: string;
    thread_id?: string;
    in_reply_to?: string;
    references?: string[];
  };

  if (!body.from_account_id || !body.to || !body.subject || !body.html) {
    return NextResponse.json(
      { error: "Missing from_account_id, to, subject, or html" },
      { status: 400 },
    );
  }

  const result = await sendEmail({
    to: body.to,
    cc: body.cc,
    subject: body.subject,
    html: body.html,
    text: body.text,
    from_account_id: body.from_account_id,
    in_reply_to: body.in_reply_to,
    references: body.references,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Persist outbound row.
  const supabase = createAdminClient();
  let threadId = body.thread_id ?? null;

  if (!threadId) {
    const { data: thread } = await supabase
      .from("email_threads")
      .insert({
        account_id: body.from_account_id,
        subject: body.subject,
        participants: [body.to, ...(body.cc ?? [])],
        last_message_at: new Date().toISOString(),
        message_count: 1,
        unread_count: 0,
        org_id: ORG_ID,
      })
      .select("id")
      .single();
    threadId = thread?.id ?? null;
  } else {
    await supabase
      .from("email_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);
  }

  if (threadId) {
    await supabase.from("email_messages").insert({
      thread_id: threadId,
      account_id: body.from_account_id,
      message_id: result.messageId,
      in_reply_to: body.in_reply_to ?? null,
      references_chain: body.references ?? [],
      from_email: null,
      to_emails: [body.to],
      cc_emails: body.cc ?? [],
      subject: body.subject,
      snippet: body.text?.slice(0, 200) ?? body.html.replace(/<[^>]+>/g, "").slice(0, 200),
      direction: "outbound",
      is_read: true,
      sent_at: new Date().toISOString(),
      org_id: ORG_ID,
    });
  }

  return NextResponse.json({
    data: { message_id: result.messageId, thread_id: threadId },
  });
}
