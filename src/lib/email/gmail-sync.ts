// Gmail sync. Two modes:
//   - backfill(accountId, days): first-time pull (default 30 days)
//   - incremental(accountId): uses stored gmail_history_id
// Both upsert email_threads + email_messages and call linkEmail() per new message.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { linkEmail } from "@/lib/email/context-linker";
import { ORG_ID } from "@/lib/email/index";
import type { gmail_v1 } from "googleapis";

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
  primeAccountEmailCache(account.id, account.email);

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
        account.gmail_history_id!,
        outcome,
      );
    } else {
      await backfillSync(
        admin,
        gmail,
        account.id,
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
  admin: ReturnType<typeof createAdminClient>,
  gmail: gmail_v1.Gmail,
  accountId: string,
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
        await upsertMessage(admin, gmail, accountId, m.id);
        outcome.upserted += 1;
      } catch (err) {
        outcome.errors.push(`${m.id}: ${(err as Error).message}`);
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
}

async function incrementalSync(
  admin: ReturnType<typeof createAdminClient>,
  gmail: gmail_v1.Gmail,
  accountId: string,
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
          await upsertMessage(admin, gmail, accountId, id);
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
  admin: ReturnType<typeof createAdminClient>,
  gmail: gmail_v1.Gmail,
  accountId: string,
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
  const accountEmail = getAccountEmailLowerCached(accountId);
  const direction =
    accountEmail && fromEmail && fromEmail.includes(accountEmail)
      ? "outbound"
      : "inbound";

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
        last_message_at: dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString(),
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

  const { data: upserted, error: upErr } = await admin
    .from("email_messages")
    .upsert(
      {
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
        sent_at: dateHeader ? new Date(dateHeader).toISOString() : null,
        org_id: ORG_ID,
      },
      { onConflict: "account_id,gmail_message_id" },
    )
    .select("id")
    .single();

  if (upErr || !upserted)
    throw new Error(upErr?.message ?? "message upsert failed");

  await admin
    .from("email_threads")
    .update({
      last_message_at: dateHeader
        ? new Date(dateHeader).toISOString()
        : new Date().toISOString(),
      snippet: (plain || "").slice(0, 200),
    })
    .eq("id", threadId);

  await linkEmail(upserted.id);
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

const emailCache = new Map<string, string>();
function getAccountEmailLowerCached(accountId: string): string {
  return emailCache.get(accountId) ?? "";
}
export function primeAccountEmailCache(accountId: string, email: string) {
  emailCache.set(accountId, email.toLowerCase());
}
