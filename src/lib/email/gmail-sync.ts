// Gmail sync. Two modes:
//   - backfill(accountId, days): first-time pull (default 30 days)
//   - incremental(accountId): uses stored gmail_history_id
// Both upsert email_threads + email_messages and call linkEmail() per new message.
//
// Idempotent: messages are matched on (account_id, gmail_message_id). Outbound
// messages already in the DB (from the send pipeline) are partial-updated to
// preserve sent_by_user_id, sent_by_agent_id, status='delivered', retry_count,
// failure_reason. Inbound messages are upserted with full payload.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { linkEmail } from "@/lib/email/context-linker";
import { ORG_ID } from "@/lib/email/index";
import type { gmail_v1 } from "googleapis";

type Admin = ReturnType<typeof createAdminClient>;

export interface SyncOutcome {
  account_id: string;
  mode: "backfill" | "incremental";
  fetched: number;
  upserted: number;
  errors: string[];
}

export async function syncGmailAccount(
  accountId: string,
  opts?: { backfillDays?: number },
): Promise<SyncOutcome> {
  const admin = createAdminClient();
  const { account, gmail } = await loadGmailClient(accountId);
  const accountEmail = account.email.toLowerCase();

  const outcome: SyncOutcome = {
    account_id: accountId,
    mode: account.gmail_history_id ? "incremental" : "backfill",
    fetched: 0,
    upserted: 0,
    errors: [],
  };

  try {
    if (outcome.mode === "incremental") {
      await incrementalSync(
        admin,
        gmail,
        account.id,
        accountEmail,
        account.gmail_history_id!,
        outcome,
      );
    } else {
      await backfillSync(
        admin,
        gmail,
        account.id,
        accountEmail,
        opts?.backfillDays ?? 30,
        outcome,
      );
    }

    const { data: profile } = await gmail.users.getProfile({ userId: "me" });
    if (profile.historyId) {
      await admin
        .from("email_accounts")
        .update({
          gmail_history_id: String(profile.historyId),
          last_sync_at: new Date().toISOString(),
          last_error: null,
          status: "connected",
        })
        .eq("id", accountId);
    }
  } catch (err) {
    const msg = (err as Error).message;
    outcome.errors.push(msg);
    await admin
      .from("email_accounts")
      .update({ last_error: msg, status: "failed" })
      .eq("id", accountId);
  }

  return outcome;
}

async function backfillSync(
  admin: Admin,
  gmail: gmail_v1.Gmail,
  accountId: string,
  accountEmail: string,
  days: number,
  outcome: SyncOutcome,
) {
  const q = `newer_than:${days}d -in:chats`;
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 100,
      pageToken,
    });
    for (const m of data.messages ?? []) {
      if (!m.id) continue;
      outcome.fetched += 1;
      try {
        await upsertMessage(admin, gmail, accountId, accountEmail, m.id);
        outcome.upserted += 1;
      } catch (err) {
        outcome.errors.push(`${m.id}: ${(err as Error).message}`);
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
}

async function incrementalSync(
  admin: Admin,
  gmail: gmail_v1.Gmail,
  accountId: string,
  accountEmail: string,
  startHistoryId: string,
  outcome: SyncOutcome,
) {
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
    });
    for (const h of data.history ?? []) {
      for (const ma of h.messagesAdded ?? []) {
        const id = ma.message?.id;
        if (!id) continue;
        outcome.fetched += 1;
        try {
          await upsertMessage(admin, gmail, accountId, accountEmail, id);
          outcome.upserted += 1;
        } catch (err) {
          outcome.errors.push(`${id}: ${(err as Error).message}`);
        }
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
}

async function upsertMessage(
  admin: Admin,
  gmail: gmail_v1.Gmail,
  accountId: string,
  accountEmail: string,
  gmailMessageId: string,
) {
  const { data: full } = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full",
  });

  const headers = new Map<string, string>(
    (full.payload?.headers ?? []).map((h) => [
      h.name!.toLowerCase(),
      h.value ?? "",
    ]),
  );
  const messageHeaderId = headers.get("message-id") ?? null;
  const inReplyTo = headers.get("in-reply-to") ?? null;
  const references = (headers.get("references") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const subject = headers.get("subject") ?? null;
  const fromEmail = parseAddress(headers.get("from") ?? "");
  const toEmails = parseAddressList(headers.get("to") ?? "");
  const ccEmails = parseAddressList(headers.get("cc") ?? "");
  const dateHeader = headers.get("date");

  const { html, text } = extractBodies(full.payload ?? {});
  const sanitizedHtml = html ? sanitizeEmailHtml(html) : "";
  const plain = text || (sanitizedHtml ? htmlToPlainText(sanitizedHtml) : "");

  const gmailThreadId = full.threadId!;
  // Exact equality after normalization. `.includes()` would mis-match
  // e.g. "bob@nexus.com" against an account "x@nexus.com".
  const direction: "inbound" | "outbound" =
    fromEmail && fromEmail === accountEmail ? "outbound" : "inbound";
  const sentAtIso = dateHeader ? new Date(dateHeader).toISOString() : null;

  // Find or create thread.
  const { data: existingThread } = await admin
    .from("email_threads")
    .select("id")
    .eq("account_id", accountId)
    .eq("gmail_thread_id", gmailThreadId)
    .maybeSingle();

  let threadId = existingThread?.id;
  if (!threadId) {
    const { data: newThread, error } = await admin
      .from("email_threads")
      .insert({
        account_id: accountId,
        gmail_thread_id: gmailThreadId,
        subject,
        participants: dedupe(
          [fromEmail, ...toEmails, ...ccEmails].filter(Boolean) as string[],
        ),
        last_message_at: sentAtIso ?? new Date().toISOString(),
        message_count: 0,
        unread_count: 0,
        snippet: (plain || "").slice(0, 200),
        org_id: ORG_ID,
      })
      .select("id")
      .single();
    if (error || !newThread)
      throw new Error(error?.message ?? "thread insert failed");
    threadId = newThread.id;
  }

  // Check if this Gmail message ID already exists. Partial-update outbound rows
  // to preserve send-pipeline state (sent_by_*, status, retry_count, etc.).
  const { data: existingMsg } = await admin
    .from("email_messages")
    .select("id, direction, body_html, body_text")
    .eq("account_id", accountId)
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();

  let messageRowId: string;

  if (existingMsg) {
    // Partial update: only fill fields that Gmail is authoritative for and
    // that we don't already have. Never touch sent_by_*, status, retry_count.
    const patch: Record<string, unknown> = {
      gmail_thread_id: gmailThreadId,
      is_read: !(full.labelIds ?? []).includes("UNREAD"),
    };
    if (!existingMsg.body_html && sanitizedHtml) patch.body_html = sanitizedHtml;
    if (!existingMsg.body_text && plain) patch.body_text = plain;
    if (sentAtIso) patch.sent_at = sentAtIso;

    const { error: updErr } = await admin
      .from("email_messages")
      .update(patch)
      .eq("id", existingMsg.id);
    if (updErr) throw new Error(updErr.message);
    messageRowId = existingMsg.id;
  } else {
    // Insert new (inbound, or outbound from outside our pipeline e.g. sent
    // from the Gmail web UI directly).
    const { data: inserted, error: insErr } = await admin
      .from("email_messages")
      .insert({
        thread_id: threadId,
        account_id: accountId,
        gmail_message_id: gmailMessageId,
        gmail_thread_id: gmailThreadId,
        message_id: messageHeaderId,
        in_reply_to: inReplyTo,
        references_chain: references,
        from_email: fromEmail,
        to_emails: toEmails,
        cc_emails: ccEmails,
        subject,
        snippet: full.snippet ?? null,
        body_html: sanitizedHtml,
        body_text: plain,
        direction,
        is_read: !(full.labelIds ?? []).includes("UNREAD"),
        status: "received",
        sent_at: sentAtIso,
        org_id: ORG_ID,
      })
      .select("id")
      .single();
    if (insErr || !inserted)
      throw new Error(insErr?.message ?? "message insert failed");
    messageRowId = inserted.id;
  }

  await admin
    .from("email_threads")
    .update({
      last_message_at: sentAtIso ?? new Date().toISOString(),
      snippet: (plain || "").slice(0, 200),
    })
    .eq("id", threadId);

  await linkEmail(messageRowId);
}

function parseAddress(raw: string): string | null {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase() || null;
}
function parseAddressList(raw: string): string[] {
  return raw
    .split(",")
    .map(parseAddress)
    .filter((x): x is string => !!x);
}
function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
function extractBodies(payload: gmail_v1.Schema$MessagePart): {
  html: string;
  text: string;
} {
  let html = "",
    text = "";
  const walk = (p: gmail_v1.Schema$MessagePart) => {
    if (p.mimeType === "text/html" && p.body?.data) {
      html += Buffer.from(p.body.data, "base64url").toString("utf-8");
    } else if (p.mimeType === "text/plain" && p.body?.data) {
      text += Buffer.from(p.body.data, "base64url").toString("utf-8");
    }
    for (const part of p.parts ?? []) walk(part);
  };
  walk(payload);
  return { html, text };
}
