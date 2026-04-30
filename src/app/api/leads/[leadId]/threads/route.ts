// GET /api/leads/[leadId]/threads — return all email threads + their messages
// for a given lead, scoped to ORG_ID. Powers the Conversations panel inside
// the lead detail view.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/email/index";

export const dynamic = "force-dynamic";

const LeadIdParam = z.string().uuid();

type ThreadRow = {
  id: string;
  account_id: string;
  subject: string | null;
  participants: string[] | null;
  last_message_at: string | null;
  message_count: number | null;
  unread_count: number | null;
  lead_id: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_email: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  snippet: string | null;
  sent_at: string | null;
  is_read: boolean | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_chain: string[] | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } },
) {
  const parsed = LeadIdParam.safeParse(params.leadId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  }
  const leadId = parsed.data;

  const supabase = createAdminClient();

  // Verify the lead exists and belongs to ORG_ID before exposing thread data.
  // Single-tenant today, but this prevents cross-tenant leakage the moment a
  // second org gets seeded — and kills SQL-error-based probing.
  const { data: leadRow, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }
  if (!leadRow) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: threads, error: threadsError } = await supabase
    .from("email_threads")
    .select(
      "id, account_id, subject, participants, last_message_at, message_count, unread_count, lead_id",
    )
    .eq("org_id", ORG_ID)
    .eq("lead_id", leadId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (threadsError) {
    return NextResponse.json({ error: threadsError.message }, { status: 500 });
  }

  const threadRows: ThreadRow[] = threads ?? [];
  const threadIds = threadRows.map((t) => t.id);

  let messageRows: MessageRow[] = [];
  if (threadIds.length > 0) {
    const { data: messages, error: messagesError } = await supabase
      .from("email_messages")
      .select(
        "id, thread_id, direction, from_email, to_emails, cc_emails, subject, snippet, sent_at, is_read, message_id, in_reply_to, references_chain",
      )
      .in("thread_id", threadIds)
      .order("sent_at", { ascending: true, nullsFirst: false });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 },
      );
    }
    messageRows = messages ?? [];
  }

  const messagesByThread = new Map<string, MessageRow[]>();
  for (const m of messageRows) {
    const arr = messagesByThread.get(m.thread_id) ?? [];
    arr.push(m);
    messagesByThread.set(m.thread_id, arr);
  }

  const shaped = threadRows.map((t) => ({
    id: t.id,
    account_id: t.account_id,
    subject: t.subject,
    participants: t.participants ?? [],
    last_message_at: t.last_message_at,
    message_count: t.message_count ?? 0,
    unread_count: t.unread_count ?? 0,
    lead_id: t.lead_id,
    messages: (messagesByThread.get(t.id) ?? []).map((m) => ({
      id: m.id,
      direction: m.direction,
      from_email: m.from_email,
      to_emails: m.to_emails ?? [],
      cc_emails: m.cc_emails ?? [],
      subject: m.subject,
      snippet: m.snippet,
      sent_at: m.sent_at,
      is_read: m.is_read ?? false,
      message_id: m.message_id,
      in_reply_to: m.in_reply_to,
      references_chain: m.references_chain ?? [],
    })),
  }));

  return NextResponse.json({ data: { threads: shaped } });
}
