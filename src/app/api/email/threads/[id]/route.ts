// GET    /api/email/threads/[id] — thread + ordered messages (without bodies)
// PATCH  /api/email/threads/[id] — toggle starred / archived / read state
// DELETE /api/email/threads/[id] — soft-delete (sets trashed_at = now())
//
// Read/unread state lives on email_messages.is_read; toggling thread read
// state fans out to inbound messages and recomputes unread_count from truth.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: thread, error: threadErr } = await supabase
    .from("email_threads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (threadErr || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: messages, error: msgErr } = await supabase
    .from("email_messages")
    .select("id, account_id, imap_uid, message_id, in_reply_to, from_email, to_emails, cc_emails, subject, snippet, direction, is_read, sent_at")
    .eq("thread_id", params.id)
    .order("sent_at", { ascending: true });

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: { thread, messages: messages ?? [] } });
}

const patchSchema = z
  .object({
    starred: z.boolean().optional(),
    archived: z.boolean().optional(),
    read: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.starred !== undefined ||
      v.archived !== undefined ||
      v.read !== undefined,
    { message: "At least one field required" },
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;
  const admin = createAdminClient();

  const threadUpdates: Record<string, unknown> = {};
  if (p.starred !== undefined) threadUpdates.starred = p.starred;
  if (p.archived !== undefined) threadUpdates.archived = p.archived;

  if (p.read !== undefined) {
    const { error: msgErr } = await admin
      .from("email_messages")
      .update({ is_read: p.read })
      .eq("thread_id", params.id)
      .eq("direction", "inbound");
    if (msgErr) {
      return NextResponse.json(
        { error: `Failed to update messages: ${msgErr.message}` },
        { status: 500 },
      );
    }
    const { count } = await admin
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", params.id)
      .eq("direction", "inbound")
      .eq("is_read", false);
    threadUpdates.unread_count = count ?? 0;
  }

  const { data, error } = await admin
    .from("email_threads")
    .update(threadUpdates)
    .eq("id", params.id)
    .select("id, starred, archived, unread_count, trashed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_threads")
    .update({ trashed_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, trashed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
