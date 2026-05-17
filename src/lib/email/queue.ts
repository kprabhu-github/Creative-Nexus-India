// Server-only helper. Allows internal routes (cron, lead followup, agent code)
// to enqueue an outbound email without round-tripping through the HTTP send route.
// Returns immediately; the worker cron at /api/cron/email-send actually sends.

import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { buildMessageId } from "@/lib/email/mime";
import { ORG_ID, type EmailContextType } from "@/lib/email/index";

export interface EnqueueInput {
  account_id: string;
  thread_id?: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  context_type?: EmailContextType;
  context_id?: string;
  agent_id?: string;
}

export interface EnqueueResult {
  message_id: string;
  thread_id: string;
}

export async function enqueueSend(
  input: EnqueueInput,
): Promise<EnqueueResult> {
  const admin = createAdminClient();
  const domain = process.env.MAIL_DOMAIN ?? "creativenexus.in";

  let threadId = input.thread_id;
  if (!threadId) {
    const { data: t, error } = await admin
      .from("email_threads")
      .insert({
        account_id: input.account_id,
        subject: input.subject,
        participants: input.to,
        last_message_at: new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        org_id: ORG_ID,
      })
      .select("id")
      .single();
    if (error || !t) {
      throw new Error(error?.message ?? "Failed to create thread");
    }
    threadId = t.id;
  }

  const html = sanitizeEmailHtml(input.html);
  const text = htmlToPlainText(html);

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: threadId,
      account_id: input.account_id,
      message_id: buildMessageId(domain),
      from_email: null,
      to_emails: input.to,
      cc_emails: input.cc ?? [],
      subject: input.subject,
      snippet: text.slice(0, 200),
      body_html: html,
      body_text: text,
      direction: "outbound",
      status: "queued",
      sent_by_agent_id: input.agent_id ?? null,
      org_id: ORG_ID,
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    throw new Error(msgErr?.message ?? "Failed to insert message");
  }

  const { error: jobErr } = await admin.from("email_send_jobs").insert({
    message_id: msg.id,
    account_id: input.account_id,
    org_id: ORG_ID,
  });
  if (jobErr) throw new Error(jobErr.message);

  if (input.context_type && input.context_id) {
    await admin.from("email_contexts").insert({
      message_id: msg.id,
      thread_id: threadId,
      context_type: input.context_type,
      context_id: input.context_id,
      link_source: "manual",
      confidence: 1.0,
      org_id: ORG_ID,
    });
  }

  return { message_id: msg.id, thread_id: threadId! };
}

export async function pickDefaultAccountId(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: def } = await admin
    .from("email_accounts")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("status", "connected")
    .eq("is_default", true)
    .maybeSingle();
  if (def?.id) return def.id;
  const { data: any } = await admin
    .from("email_accounts")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("status", "connected")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return any?.id ?? null;
}
