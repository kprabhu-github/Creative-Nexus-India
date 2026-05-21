// POST /api/email/send
// Validates payload + Idempotency-Key, claims the key atomically, then inserts
// queued email_messages + email_send_jobs rows. If the queue insert fails after
// the message insert, the message is marked failed and the idempotency response
// carries the error so replays see the same failure rather than double-sending.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email/sanitize";
import { buildMessageId } from "@/lib/email/mime";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";

const CLAIM_TTL_MS = 30_000;
const PG_UNIQUE_VIOLATION = "23505";

const ATTACHMENT_TOTAL_CAP = 25 * 1024 * 1024;

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mime: z.string().min(1).max(255),
  size: z.number().int().positive().max(20 * 1024 * 1024),
  storage_path: z.string().min(1).max(1024),
});

const sendSchema = z.object({
  account_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  bcc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().min(1).max(998),
  html: z.string().min(1).max(500_000),
  attachments: z.array(attachmentSchema).max(10).optional(),
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

type Admin = ReturnType<typeof createAdminClient>;

interface ClaimedBody {
  _claimed: true;
  ts: number;
}

interface FinalBody {
  success: boolean;
  message_id?: string;
  thread_id?: string;
  status: "queued" | "failed";
  error?: string;
}

function isClaimed(body: unknown): body is ClaimedBody {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { _claimed?: boolean })._claimed === true
  );
}

type ClaimResult =
  | { claimed: true }
  | { claimed: false; existing: FinalBody | null; status: number };

async function claimIdempotencyKey(
  admin: Admin,
  key: string,
  userId: string,
): Promise<ClaimResult> {
  const placeholder: ClaimedBody = { _claimed: true, ts: Date.now() };
  const { error } = await admin.from("email_idempotency_keys").insert({
    key,
    user_id: userId,
    response_body: placeholder,
    org_id: ORG_ID,
  });

  if (!error) return { claimed: true };
  if (error.code !== PG_UNIQUE_VIOLATION) {
    throw new Error(`Idempotency claim failed: ${error.message}`);
  }

  // Key already exists — fetch the stored body to decide what to return.
  const { data } = await admin
    .from("email_idempotency_keys")
    .select("response_body")
    .eq("key", key)
    .single();

  const body = data?.response_body as unknown;
  if (isClaimed(body)) {
    const age = Date.now() - body.ts;
    if (age < CLAIM_TTL_MS) {
      return {
        claimed: false,
        existing: { success: false, status: "failed", error: "in_progress" },
        status: 409,
      };
    }
    // Claim is stale — original request likely died. Surface that to the caller.
    return {
      claimed: false,
      existing: {
        success: false,
        status: "failed",
        error: "previous_attempt_stalled",
      },
      status: 409,
    };
  }
  return { claimed: false, existing: body as FinalBody, status: 200 };
}

async function settleIdempotency(
  admin: Admin,
  key: string,
  body: FinalBody,
): Promise<void> {
  await admin
    .from("email_idempotency_keys")
    .update({ response_body: body })
    .eq("key", key);
}

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

  if (p.attachments?.length) {
    const total = p.attachments.reduce((sum, a) => sum + a.size, 0);
    if (total > ATTACHMENT_TOTAL_CAP) {
      return NextResponse.json(
        { error: `Attachments exceed ${ATTACHMENT_TOTAL_CAP} byte cap` },
        { status: 413 },
      );
    }
  }

  const admin = createAdminClient();

  // Atomically claim or detect the idempotency key BEFORE side effects.
  const claim = await claimIdempotencyKey(admin, idempotencyKey, user.id);
  if (!claim.claimed) {
    return NextResponse.json(claim.existing, { status: claim.status });
  }

  // From here on, any early return must call settleIdempotency() so replays
  // see the final status instead of the placeholder.
  try {
    const { data: account, error: acctErr } = await admin
      .from("email_accounts")
      .select("id, email, provider, status")
      .eq("id", p.account_id)
      .eq("status", "connected")
      .single();
    if (acctErr || !account) {
      const err: FinalBody = {
        success: false,
        status: "failed",
        error: "Account not found or disconnected",
      };
      await settleIdempotency(admin, idempotencyKey, err);
      return NextResponse.json(err, { status: 404 });
    }

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
        const err: FinalBody = {
          success: false,
          status: "failed",
          error: "Failed to create thread",
        };
        await settleIdempotency(admin, idempotencyKey, err);
        return NextResponse.json(err, { status: 500 });
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
        attachments_json: p.attachments?.length ? p.attachments : null,
        direction: "outbound",
        status: "queued",
        sent_by_user_id: user.id,
        org_id: ORG_ID,
      })
      .select("id, thread_id")
      .single();

    if (msgErr || !msg) {
      const err: FinalBody = {
        success: false,
        status: "failed",
        error: `Failed to create message: ${msgErr?.message ?? "unknown"}`,
      };
      await settleIdempotency(admin, idempotencyKey, err);
      return NextResponse.json(err, { status: 500 });
    }

    // Enqueue. If this fails, the message would be orphaned in 'queued'.
    // Mark it failed so the user gets a clear error instead of silent loss.
    const { error: jobErr } = await admin.from("email_send_jobs").insert({
      message_id: msg.id,
      account_id: p.account_id,
      org_id: ORG_ID,
    });
    if (jobErr) {
      await admin
        .from("email_messages")
        .update({ status: "failed", failure_reason: "enqueue_failed" })
        .eq("id", msg.id);
      const err: FinalBody = {
        success: false,
        status: "failed",
        error: `Failed to enqueue: ${jobErr.message}`,
      };
      await settleIdempotency(admin, idempotencyKey, err);
      return NextResponse.json(err, { status: 500 });
    }

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

    const response: FinalBody = {
      success: true,
      message_id: msg.id,
      thread_id: msg.thread_id,
      status: "queued",
    };
    await settleIdempotency(admin, idempotencyKey, response);
    return NextResponse.json(response, { status: 202 });
  } catch (err) {
    const errBody: FinalBody = {
      success: false,
      status: "failed",
      error: err instanceof Error ? err.message : "unexpected_error",
    };
    await settleIdempotency(admin, idempotencyKey, errBody).catch(() => {});
    return NextResponse.json(errBody, { status: 500 });
  }
}
