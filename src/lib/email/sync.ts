// IMAP → Supabase sync.
// For each connected account: fetch UIDs > last_sync_uid, upsert threads + messages,
// match by email to leads.

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSinceUid, type ImapAccountRow, type ImapEnvelope } from "./imap";
import { ORG_ID } from "./index";

export interface SyncResult {
  account_id: string;
  email: string;
  fetched: number;
  newThreads: number;
  newMessages: number;
  error?: string;
}

async function findLeadByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  fromEmail: string | null,
): Promise<string | null> {
  if (!fromEmail) return null;
  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .eq("email", fromEmail.toLowerCase())
    .limit(2);
  if (error || !data || data.length !== 1) return null;
  return data[0].id as string;
}

async function findOrCreateThread(
  supabase: ReturnType<typeof createAdminClient>,
  accountId: string,
  envelope: ImapEnvelope,
): Promise<string> {
  // Try to match an existing thread by the In-Reply-To or References chain.
  const candidateIds = [
    envelope.inReplyTo,
    ...envelope.references,
  ].filter((s): s is string => Boolean(s));

  if (candidateIds.length > 0) {
    const { data: existing } = await supabase
      .from("email_messages")
      .select("thread_id")
      .in("message_id", candidateIds)
      .eq("account_id", accountId)
      .limit(1);
    if (existing && existing.length > 0 && existing[0].thread_id) {
      return existing[0].thread_id as string;
    }
  }

  // Else create a new thread.
  const leadId = await findLeadByEmail(supabase, envelope.fromEmail);
  const participants = Array.from(
    new Set([envelope.fromEmail, ...envelope.toEmails, ...envelope.ccEmails].filter((s): s is string => Boolean(s))),
  );

  const { data: created, error } = await supabase
    .from("email_threads")
    .insert({
      account_id: accountId,
      subject: envelope.subject || null,
      participants,
      last_message_at: envelope.sentAt?.toISOString() ?? new Date().toISOString(),
      message_count: 0,
      unread_count: 0,
      lead_id: leadId,
      org_id: ORG_ID,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Thread create failed");
  return created.id as string;
}

export async function syncAccount(account: ImapAccountRow & {
  id: string;
  last_sync_uid: number | null;
}): Promise<SyncResult> {
  const supabase = createAdminClient();
  const result: SyncResult = {
    account_id: account.id,
    email: account.email,
    fetched: 0,
    newThreads: 0,
    newMessages: 0,
  };

  let envelopes: ImapEnvelope[] = [];
  try {
    envelopes = await fetchSinceUid(account, account.last_sync_uid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "IMAP fetch failed";
    result.error = msg;
    await supabase
      .from("email_accounts")
      .update({ status: "failed", last_error: msg })
      .eq("id", account.id);
    return result;
  }

  result.fetched = envelopes.length;
  let maxUid = account.last_sync_uid ?? 0;

  for (const env of envelopes) {
    if (env.uid > maxUid) maxUid = env.uid;

    const threadId = await findOrCreateThread(supabase, account.id, env);

    const { error: insertErr } = await supabase
      .from("email_messages")
      .upsert(
        {
          thread_id: threadId,
          account_id: account.id,
          imap_uid: env.uid,
          message_id: env.messageId,
          in_reply_to: env.inReplyTo,
          references_chain: env.references,
          from_email: env.fromEmail,
          to_emails: env.toEmails,
          cc_emails: env.ccEmails,
          subject: env.subject,
          snippet: env.snippet,
          direction: "inbound",
          is_read: env.isRead,
          sent_at: env.sentAt?.toISOString() ?? null,
          org_id: ORG_ID,
        },
        { onConflict: "account_id,imap_uid" },
      );
    if (!insertErr) result.newMessages++;
  }

  // Refresh thread counters.
  if (envelopes.length > 0) {
    const threadIds = await supabase
      .from("email_messages")
      .select("thread_id")
      .eq("account_id", account.id)
      .in("imap_uid", envelopes.map((e) => e.uid));

    const uniqueThreads = Array.from(new Set((threadIds.data ?? []).map((r) => r.thread_id as string)));
    for (const tid of uniqueThreads) {
      const { count: total } = await supabase
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", tid);
      const { count: unread } = await supabase
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", tid)
        .eq("is_read", false);
      const latest = envelopes
        .filter((e) => e.sentAt)
        .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0];
      await supabase
        .from("email_threads")
        .update({
          message_count: total ?? 0,
          unread_count: unread ?? 0,
          last_message_at: latest?.sentAt?.toISOString() ?? new Date().toISOString(),
        })
        .eq("id", tid);
    }
  }

  await supabase
    .from("email_accounts")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_uid: maxUid,
      status: "connected",
      last_error: null,
    })
    .eq("id", account.id);

  return result;
}
