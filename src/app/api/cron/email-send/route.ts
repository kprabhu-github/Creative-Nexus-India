// GET /api/cron/email-send
// Hostinger cron pings this every minute.
// 1. Reap stale locks (jobs locked > STALE_LOCK_MS ago — worker likely died).
// 2. Lock up to EMAIL_WORKER_BATCH_SIZE pending jobs via FOR UPDATE SKIP LOCKED.
// 3. For each: idempotency-check the message, send via Gmail API, update status.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { buildMime, toBase64Url } from "@/lib/email/mime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const BATCH = Number(process.env.EMAIL_WORKER_BATCH_SIZE ?? 10);
const STALE_LOCK_MS = 5 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.EMAIL_WORKER_CRON_SECRET;
  if (!secret) {
    // Fail closed in production; dev convenience only.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Worker secret not configured" },
        { status: 500 },
      );
    }
    return null;
  }
  const got = req.headers.get("x-cron-secret");
  if (got !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

interface LockedJob {
  id: string;
  message_id: string;
  account_id: string;
  attempts: number;
  max_attempts: number;
}

async function reapStaleLocks(admin: Admin): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data } = await admin
    .from("email_send_jobs")
    .update({
      status: "pending",
      locked_at: null,
      locked_by: null,
    })
    .eq("status", "locked")
    .lt("locked_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}

export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = createAdminClient();
  const reaped = await reapStaleLocks(admin);

  const { data: jobs, error: lockErr } = await admin.rpc(
    "lock_email_send_jobs",
    { p_worker: WORKER_ID, p_limit: BATCH },
  );

  if (lockErr) {
    console.error("[email-send] lock failed", lockErr);
    return NextResponse.json({ error: lockErr.message }, { status: 500 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of (jobs ?? []) as LockedJob[]) {
    try {
      const outcome = await processJob(admin, job);
      results.push({ id: job.id, status: outcome });
    } catch (err) {
      const msg = (err as Error).message;
      const attempts = job.attempts + 1;
      const failed = attempts >= job.max_attempts;
      const backoffMs = Math.min(60_000, Math.pow(2, attempts) * 1000);
      await admin
        .from("email_send_jobs")
        .update({
          status: failed ? "failed" : "pending",
          locked_at: null,
          locked_by: null,
          attempts,
          last_error: msg,
          run_after: new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq("id", job.id);
      await admin
        .from("email_messages")
        .update({
          status: failed ? "failed" : "queued",
          failure_reason: msg,
          retry_count: attempts,
        })
        .eq("id", job.message_id);
      results.push({
        id: job.id,
        status: failed ? "failed" : "retrying",
        error: msg,
      });
    }
  }

  return NextResponse.json({
    reaped,
    processed: results.length,
    results,
  });
}

async function processJob(admin: Admin, job: LockedJob): Promise<string> {
  // Idempotency guard: if a prior worker delivered this message but crashed
  // before clearing the lock, do NOT re-send. Just settle the job.
  const { data: pre } = await admin
    .from("email_messages")
    .select(
      "id, status, sent_at, gmail_message_id, message_id, in_reply_to, references_chain, to_emails, cc_emails, subject, body_html, body_text, thread_id",
    )
    .eq("id", job.message_id)
    .single();

  if (!pre) {
    await admin
      .from("email_send_jobs")
      .update({ status: "failed", locked_at: null, locked_by: null })
      .eq("id", job.id);
    throw new Error(`message ${job.message_id} not found`);
  }

  if (pre.status === "delivered" || pre.sent_at || pre.gmail_message_id) {
    await admin
      .from("email_send_jobs")
      .update({ status: "done", locked_at: null, locked_by: null })
      .eq("id", job.id);
    return "already_delivered";
  }

  await admin
    .from("email_messages")
    .update({ status: "sending" })
    .eq("id", job.message_id);

  const { data: thread } = await admin
    .from("email_threads")
    .select("id, gmail_thread_id")
    .eq("id", pre.thread_id)
    .single();
  const gmailThreadIdHint = thread?.gmail_thread_id ?? undefined;

  const { account, gmail } = await loadGmailClient(job.account_id);

  const mime = buildMime({
    from: account.email,
    fromName: account.display_name,
    to: pre.to_emails,
    cc: pre.cc_emails,
    subject: pre.subject ?? "(no subject)",
    html: pre.body_html ?? "",
    text: pre.body_text ?? "",
    messageId: pre.message_id!,
    inReplyTo: pre.in_reply_to,
    references: pre.references_chain,
  });
  const raw = toBase64Url(mime);

  const { data: sendResult } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: gmailThreadIdHint },
  });

  await admin
    .from("email_send_jobs")
    .update({ status: "done", locked_at: null, locked_by: null })
    .eq("id", job.id);

  await admin
    .from("email_messages")
    .update({
      status: "delivered",
      sent_at: new Date().toISOString(),
      gmail_message_id: sendResult.id ?? null,
      gmail_thread_id: sendResult.threadId ?? null,
    })
    .eq("id", job.message_id);

  if (sendResult.threadId && !gmailThreadIdHint) {
    await admin
      .from("email_threads")
      .update({
        gmail_thread_id: sendResult.threadId,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", pre.thread_id);
  }

  return "delivered";
}
