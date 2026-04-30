// POST /api/email/send — first-class send endpoint that also persists
// the outbound message to email_threads/email_messages.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// SMTP header injection guard: any \r or \n in a header field can smuggle
// extra headers (Bcc, etc.). Reject CRLF in every string that flows into
// MIME headers (subject, in_reply_to, references entries).
const noCRLF = z.string().regex(/^[^\r\n]*$/, "header values cannot contain CRLF");

const SendBody = z.object({
  from_account_id: z.string().uuid(),
  to: z.string().email().max(254),
  cc: z.array(z.string().email().max(254)).max(20).optional(),
  subject: noCRLF.min(1).max(998),
  html: z.string().min(1).max(500_000),
  text: z.string().max(500_000).optional(),
  thread_id: z.string().uuid().optional(),
  in_reply_to: noCRLF.max(998).optional(),
  references: z.array(noCRLF.max(998)).max(50).optional(),
  lead_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SendBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 },
    );
  }
  const body = parsed.data;

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

  // Defense-in-depth: persist using the account_id that sendEmail() actually
  // resolved/used, not the raw body value. They should match, but if a future
  // refactor changes resolution (e.g. fallback mailbox), the persisted row
  // will still match the wire-sent row.
  const persistedAccountId = result.account_id ?? body.from_account_id;

  // Persist outbound row.
  const supabase = createAdminClient();
  let threadId = body.thread_id ?? null;

  if (!threadId) {
    // Resolve lead_id: prefer explicit body.lead_id, otherwise try to look up
    // a lead by recipient email so outbound sends auto-link when possible.
    let resolvedLeadId: string | null = body.lead_id ?? null;
    if (!resolvedLeadId) {
      try {
        const { data: leadRow } = await supabase
          .from("leads")
          .select("id")
          .eq("email", body.to)
          .maybeSingle();
        resolvedLeadId = leadRow?.id ?? null;
      } catch {
        // Tolerant lookup — if leads query fails, proceed with null.
        resolvedLeadId = null;
      }
    }

    const { data: thread } = await supabase
      .from("email_threads")
      .insert({
        account_id: persistedAccountId,
        subject: body.subject,
        participants: [body.to, ...(body.cc ?? [])],
        last_message_at: new Date().toISOString(),
        message_count: 1,
        unread_count: 0,
        lead_id: resolvedLeadId,
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
      account_id: persistedAccountId,
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
