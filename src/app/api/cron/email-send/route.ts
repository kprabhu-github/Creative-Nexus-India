// GET /api/cron/email-send
// Hostinger cron pings this every minute.
// Locks up to EMAIL_WORKER_BATCH_SIZE pending jobs, sends via Gmail API,
// updates status. Retries with exponential backoff up to max_attempts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadGmailClient } from "@/lib/email/gmail-client";
import { buildMime, toBase64Url } from "@/lib/email/mime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const BATCH = Number(process.env.EMAIL_WORKER_BATCH_SIZE ?? 10);

function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.EMAIL_WORKER_CRON_SECRET;
  if (!secret) return null; // dev: allow
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

export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = createAdminClient();

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
      await processJob(admin, job);
      results.push({ id: job.id, status: "delivered" });
    } catch (err) {
      const msg = (err as Error).message;
      const attempts = job.attempts + 1;
      const failed = attempts >= job.max_attempts;
      await admin
        .from("email_send_jobs")
        .update({
          status: failed ? "failed" : "pending",
          locked_at: null,
          locked_by: null,
          attempts,
          last_error: msg,
          run_after: new Date(
            Date.now() + Math.pow(2, attempts) * 1000,
          ).toISOString(),
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

  return NextResponse.json({ processed: results.length, results });
}

async function processJob(
  admin: ReturnType<typeof createAdminClient>,
  job: LockedJob,
) {
  await admin
    .from("email_messages")
    .update({ status: "sending" })
    .eq("id", job.message_id);

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .select("*, email_threads!inner(id, gmail_thread_id)")
    .eq("id", job.message_id)
    .single();
  if (msgErr || !msg) throw new Error(`message ${job.message_id} not found`);

  const { account, gmail } = await loadGmailClient(job.account_id);

  const mime = buildMime({
    from: account.email,
    fromName: account.display_name,
    to: msg.to_emails,
    cc: msg.cc_emails,
    subject: msg.subject ?? "(no subject)",
    html: msg.body_html ?? "",
    text: msg.body_text ?? "",
    messageId: msg.message_id!,
    inReplyTo: msg.in_reply_to,
    references: msg.references_chain,
  });

  const raw = toBase64Url(mime);
  const threadFromRel = (
    msg as unknown as {
      email_threads: { gmail_thread_id: string | null };
    }
  ).email_threads;

  const { data: sendResult } = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: threadFromRel.gmail_thread_id ?? undefined,
    },
  });

  await admin
    .from("email_send_jobs")
    .update({
      status: "done",
      locked_at: null,
      locked_by: null,
    })
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

  if (sendResult.threadId && !threadFromRel.gmail_thread_id) {
    await admin
      .from("email_threads")
      .update({
        gmail_thread_id: sendResult.threadId,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", msg.thread_id);
  }
}
