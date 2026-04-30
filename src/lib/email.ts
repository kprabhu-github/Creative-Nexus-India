// ─── Email send (multi-account) ──────────────────────────────────────────
// Backwards-compatible shim. The original singleton (env-driven SMTP) is
// gone — sends now route through `email_accounts` rows in Supabase.
// Callers may pass `from_account_id` to target a specific mailbox; if
// omitted, the first connected account is used.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendFromAccount, type EmailAccountRow } from "@/lib/email/smtp";
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

export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ success: boolean; messageId?: string; error?: string; account_id?: string }> {
  const supabase = createAdminClient();

  // Pick account: explicit ID, else first connected account in this org.
  const query = supabase
    .from("email_accounts")
    .select("id, email, display_name, smtp_host, smtp_port, app_password_encrypted")
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
    const result = await sendFromAccount(account as EmailAccountRow, {
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      inReplyTo: options.in_reply_to,
      references: options.references,
    });
    return {
      success: true,
      messageId: result.messageId,
      account_id: account.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[email] Send failed:", message);
    return { success: false, error: message };
  }
}

export function getDefaultCc(): string[] {
  const cc = process.env.SMTP_CC || "";
  return cc.split(",").map((e) => e.trim()).filter(Boolean);
}
