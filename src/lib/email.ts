// ─── Email send (multi-account, dual-provider) ───────────────────────────
// Sync-shaped send for callers that need an immediate success/failure
// (e.g. lead_emails flows that update the row status right after the call).
// Dispatches by account.provider:
//   - gmail_oauth → builds MIME + calls gmail.users.messages.send directly
//   - smtp_imap   → existing nodemailer transport via sendFromAccount()
// Both paths return the same {success, messageId, account_id} shape.
//
// NOTE: this is still the synchronous path. The queued path
// (`enqueueSend` from @/lib/email/queue, or `POST /api/email/send`) is
// preferred for new code because the worker handles retry, threading, and
// status updates via Supabase Realtime. Phase 2.5 migrates the lead_emails
// callers once their UI consumes Realtime status events.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendFromAccount, type EmailAccountRow } from "@/lib/email/smtp";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { buildMime, toBase64Url, buildMessageId } from "@/lib/email/mime";
import { ORG_ID } from "@/lib/email/index";

interface SendEmailOptions {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
  from_account_id?: string;
  in_reply_to?: string;
  references?: string[];
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  account_id?: string;
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  const supabase = createAdminClient();

  // Pick account: explicit ID, else first connected account in this org.
  const query = supabase
    .from("email_accounts")
    .select("id, email, display_name, provider, smtp_host, smtp_port, app_password_encrypted")
    .eq("org_id", ORG_ID)
    .eq("status", "connected");

  const { data: account, error: queryErr } = options.from_account_id
    ? await query.eq("id", options.from_account_id).single()
    : await query.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (queryErr || !account) {
    return {
      success: false,
      error:
        "No connected email account. Visit /settings/integrations to connect a mailbox.",
    };
  }

  try {
    const messageId =
      account.provider === "gmail_oauth"
        ? await sendViaGmailApi(account.id, options)
        : (
            await sendFromAccount(account as EmailAccountRow, {
              to: options.to,
              cc: options.cc,
              subject: options.subject,
              html: options.html,
              text: options.text,
              inReplyTo: options.in_reply_to,
              references: options.references,
            })
          ).messageId;

    return { success: true, messageId, account_id: account.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[email] Send failed:", message);
    return { success: false, error: message };
  }
}

async function sendViaGmailApi(
  accountId: string,
  options: SendEmailOptions,
): Promise<string> {
  const { account, gmail } = await loadGmailClient(accountId);
  const domain = process.env.MAIL_DOMAIN ?? "creativenexus.in";
  const localMessageId = buildMessageId(domain);

  const mime = buildMime({
    from: account.email,
    fromName: account.display_name,
    to: [options.to],
    cc: options.cc,
    subject: options.subject,
    html: options.html,
    text: options.text ?? options.html.replace(/<[^>]+>/g, ""),
    messageId: localMessageId,
    inReplyTo: options.in_reply_to ?? null,
    references: options.references ?? null,
  });

  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: toBase64Url(mime) },
  });

  // Prefer Gmail's id (matches what shows up in their UI) but fall back to
  // our locally-generated Message-ID header for caller traceability.
  return data.id ?? localMessageId;
}

export function getDefaultCc(): string[] {
  const cc = process.env.SMTP_CC || "";
  return cc.split(",").map((e) => e.trim()).filter(Boolean);
}
