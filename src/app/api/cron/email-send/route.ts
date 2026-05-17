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
// A gmail.send call genuinely in progress should never be interrupted. The
// reaper does NOT reset jobs whose message is in status='sending' with a
// recent sending_started_at. Aligned with the route's maxDuration (60s) plus
// safety margin: if the Node process was killed mid-send by Hostinger, we
// know within 2 minutes and can retry. Longer values (e.g. 10m) cause
// pointless unavailability when a worker is genuinely dead.
const SENDING_HEARTBEAT_MS = 2 * 60 * 1000;
// Cap how many stale-locked candidates we inspect per tick. Without this the
// IN(...) clause could grow unbounded during extended outages.
const REAP_CANDIDATE_LIMIT = BATCH * 5;

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
  const lockCutoff = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const sendingCutoff = new Date(
    Date.now() - SENDING_HEARTBEAT_MS,
  ).toISOString();

  // Pull candidate locked jobs that look stale by lock age. Capped so we don't
  // build an unbounded IN(...) below during long outages.
  const { data: candidates } = await admin
    .from("email_send_jobs")
    .select("id, message_id")
    .eq("status", "locked")
    .lt("locked_at", lockCutoff)
    .limit(REAP_CANDIDATE_LIMIT);

  if (!candidates || candidates.length === 0) return 0;

  const messageIds = candidates.map((c) => c.message_id);
  const { data: msgs } = await admin
    .from("email_messages")
    .select("id, status, sending_started_at")
    .in("id", messageIds);

  const msgById = new Map(msgs?.map((m) => [m.id, m]) ?? []);
  const safeToReap = candidates.filter((c) => {
    const m = msgById.get(c.message_id);
    if (!m) return true; // message gone, job is junk
    if (m.status !== "sending") return true; // not mid-send, safe
    // Mid-send: only reap if heartbeat is also stale (worker truly crashed
    // during the Gmail API call, not just slow).
    return m.sending_started_at && m.sending_started_at < sendingCutoff;
  });

  if (safeToReap.length === 0) return 0;

  const { data: reaped } = await admin
    .from("email_send_jobs")
    .update({
      status: "pending",
      locked_at: null,
      locked_by: null,
    })
    .in(
      "id",
      safeToReap.map((j) => j.id),
    )
    .select("id");
  return reaped?.length ?? 0;
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
  // Pre-send idempotency guard. Three conditions short-circuit the actual send:
  //   1) Message already delivered  → settle job, do nothing.
  //   2) Message currently in 'sending' with a fresh heartbeat → another worker
  //      is mid-flight (reaper raced us). Release the lock back to pending so
  //      the original worker can finish, with a small backoff.
  //   3) Message in 'sending' with a stale heartbeat → original worker crashed
  //      mid-flight. We take over.
  const { data: pre } = await admin
    .from("email_messages")
    .select(
      "id, status, sent_at, gmail_message_id, sending_started_at, message_id, in_reply_to, references_chain, to_emails, cc_emails, subject, body_html, body_text, thread_id",
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

  if (pre.status === "sending") {
    const heartbeatFresh =
      pre.sending_started_at &&
      Date.now() - new Date(pre.sending_started_at).getTime() <
        SENDING_HEARTBEAT_MS;
    if (heartbeatFresh) {
      await admin
        .from("email_send_jobs")
        .update({
          status: "pending",
          locked_at: null,
          locked_by: null,
          run_after: new Date(Date.now() + 30_000).toISOString(),
        })
        .eq("id", job.id);
      return "in_progress_by_another_worker";
    }
    // else: heartbeat stale → fall through and take over.
  }

  // Conditional flip: only transition from 'queued' (or 'failed' on retry).
  // If another worker beat us to it (raced past the heartbeat check above),
  // the WHERE clause matches nothing and the rowcount-less update is a no-op.
  // Combined with `lock_email_send_jobs` (FOR UPDATE SKIP LOCKED) this is
  // belt-and-suspenders against double-send.
  await admin
    .from("email_messages")
    .update({
      status: "sending",
      sending_started_at: new Date().toISOString(),
    })
    .eq("id", job.message_id)
    .in("status", ["queued", "failed"]);

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
