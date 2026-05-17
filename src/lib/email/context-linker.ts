// Auto-link rules engine. Runs after each upserted email message.
// Rules (in order, additive — one email can have many context rows):
//  1. Domain match  -> clients
//  2. Email match   -> leads
//  3. Subject regex -> proposals (e.g. PROP-2026-0042)
//  4. Thread inherit: copy existing thread contexts to the new message
// Idempotent via UNIQUE (message_id, context_type, context_id).

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ORG_ID,
  type EmailContextType,
  type EmailLinkSource,
} from "@/lib/email/index";

interface LinkCandidate {
  context_type: EmailContextType;
  context_id: string;
  link_source: EmailLinkSource;
  confidence: number;
}

export async function linkEmail(messageId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: msg, error } = await admin
    .from("email_messages")
    .select("id, thread_id, from_email, to_emails, subject")
    .eq("id", messageId)
    .single();
  if (error || !msg) return 0;

  const senders = [msg.from_email, ...(msg.to_emails ?? [])]
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());
  const domains = Array.from(
    new Set(senders.map((e) => e.split("@")[1]).filter(Boolean)),
  );

  const candidates: LinkCandidate[] = [];

  // Rule 1: clients by domain. Only swallow "undefined_table" (42P01) so a
  // misconfigured RLS policy / permission error surfaces in the logs.
  if (domains.length) {
    const { data: clients, error: clientErr } = await admin
      .from("clients")
      .select("id")
      .in("domain", domains);
    if (clientErr && clientErr.code !== "42P01") {
      console.error("[context-linker] clients lookup failed", clientErr);
    } else {
      for (const c of clients ?? []) {
        candidates.push({
          context_type: "client",
          context_id: c.id,
          link_source: "auto_domain",
          confidence: 0.9,
        });
      }
    }
  }

  // Rule 2: leads by email
  if (senders.length) {
    const { data: leads } = await admin
      .from("leads")
      .select("id")
      .in("email", senders);
    for (const l of leads ?? []) {
      candidates.push({
        context_type: "lead",
        context_id: l.id,
        link_source: "auto_email",
        confidence: 1.0,
      });
    }
  }

  // Rule 3: proposal code in subject. Same error-code-specific tolerance as Rule 1.
  if (msg.subject) {
    const m = msg.subject.match(/PROP-\d{4}-\d{4}/);
    if (m) {
      const { data: prop, error: propErr } = await admin
        .from("proposals")
        .select("id")
        .eq("code", m[0])
        .maybeSingle();
      if (propErr && propErr.code !== "42P01") {
        console.error("[context-linker] proposals lookup failed", propErr);
      } else if (prop) {
        candidates.push({
          context_type: "proposal",
          context_id: prop.id,
          link_source: "auto_subject",
          confidence: 1.0,
        });
      }
    }
  }

  // Rule 4: inherit from siblings on the same thread
  const { data: siblings } = await admin
    .from("email_contexts")
    .select("context_type, context_id")
    .eq("thread_id", msg.thread_id)
    .neq("message_id", msg.id);
  for (const s of siblings ?? []) {
    if (!s.context_id) continue;
    candidates.push({
      context_type: s.context_type as EmailContextType,
      context_id: s.context_id,
      link_source: "auto_thread",
      confidence: 0.95,
    });
  }

  if (candidates.length === 0) return 0;

  const unique = new Map<string, LinkCandidate>();
  for (const c of candidates)
    unique.set(`${c.context_type}:${c.context_id}`, c);

  const rows = Array.from(unique.values()).map((c) => ({
    message_id: msg.id,
    thread_id: msg.thread_id,
    context_type: c.context_type,
    context_id: c.context_id,
    link_source: c.link_source,
    confidence: c.confidence,
    org_id: ORG_ID,
  }));

  const { error: insErr } = await admin
    .from("email_contexts")
    .upsert(rows, {
      onConflict: "message_id,context_type,context_id",
      ignoreDuplicates: true,
    });
  if (insErr)
    console.error("[context-linker] upsert failed", insErr.message);

  return rows.length;
}
