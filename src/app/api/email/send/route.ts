// POST /api/email/send
// Validates payload + Idempotency-Key, inserts queued email_messages row,
// enqueues email_send_jobs row, returns 202 with message id.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { buildMessageId } from "@/lib/email/mime";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  account_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  bcc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().min(1).max(998),
  html: z.string().min(1).max(500_000),
  context_type: z
    .enum([
      "lead",
      "proposal",
      "deal",
      "client",
      "campaign",
      "project",
      "none",
    ])
    .optional(),
  context_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Replay check
  const { data: existing } = await admin
    .from("email_idempotency_keys")
    .select("response_body")
    .eq("key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(existing.response_body, { status: 200 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;

  const { data: account, error: acctErr } = await admin
    .from("email_accounts")
    .select("id, email, provider, status")
    .eq("id", p.account_id)
    .eq("status", "connected")
    .single();
  if (acctErr || !account) {
    return NextResponse.json(
      { error: "Account not found or disconnected" },
      { status: 404 },
    );
  }

  // Resolve thread + parent message for threading headers.
  let threadRow: { id: string; gmail_thread_id: string | null } | null = null;
  let parent: {
    message_id: string | null;
    references_chain: string[];
  } | null = null;

  if (p.thread_id) {
    const { data: t } = await admin
      .from("email_threads")
      .select("id, gmail_thread_id")
      .eq("id", p.thread_id)
      .single();
    threadRow = t ?? null;

    const { data: parentMsg } = await admin
      .from("email_messages")
      .select("message_id, references_chain")
      .eq("thread_id", p.thread_id)
      .order("sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    parent = parentMsg ?? null;
  } else {
    const { data: newThread, error } = await admin
      .from("email_threads")
      .insert({
        account_id: p.account_id,
        subject: p.subject,
        participants: [...p.to, ...(p.cc ?? []), account.email],
        last_message_at: new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        org_id: ORG_ID,
      })
      .select("id, gmail_thread_id")
      .single();
    if (error || !newThread) {
      return NextResponse.json(
        { error: "Failed to create thread" },
        { status: 500 },
      );
    }
    threadRow = newThread;
  }

  const domain = process.env.MAIL_DOMAIN ?? "creativenexus.in";
  const messageHeaderId = buildMessageId(domain);
  const html = sanitizeEmailHtml(p.html);
  const text = htmlToPlainText(html);

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: threadRow!.id,
      account_id: p.account_id,
      message_id: messageHeaderId,
      in_reply_to: parent?.message_id ?? null,
      references_chain: parent
        ? [
            ...parent.references_chain,
            ...(parent.message_id ? [parent.message_id] : []),
          ]
        : [],
      from_email: account.email,
      to_emails: p.to,
      cc_emails: p.cc ?? [],
      subject: p.subject,
      snippet: text.slice(0, 200),
      body_html: html,
      body_text: text,
      direction: "outbound",
      status: "queued",
      sent_by_user_id: user.id,
      org_id: ORG_ID,
    })
    .select("id, thread_id")
    .single();

  if (msgErr || !msg) {
    return NextResponse.json(
      { error: "Failed to create message", detail: msgErr?.message },
      { status: 500 },
    );
  }

  await admin.from("email_send_jobs").insert({
    message_id: msg.id,
    account_id: p.account_id,
    org_id: ORG_ID,
  });

  if (p.context_type && p.context_id) {
    await admin.from("email_contexts").insert({
      message_id: msg.id,
      thread_id: threadRow!.id,
      context_type: p.context_type,
      context_id: p.context_id,
      link_source: "manual",
      confidence: 1.0,
      org_id: ORG_ID,
    });
  }

  const responseBody = {
    success: true,
    message_id: msg.id,
    thread_id: msg.thread_id,
    status: "queued",
  };

  await admin.from("email_idempotency_keys").insert({
    key: idempotencyKey,
    user_id: user.id,
    response_body: responseBody,
    org_id: ORG_ID,
  });

  return NextResponse.json(responseBody, { status: 202 });
}
