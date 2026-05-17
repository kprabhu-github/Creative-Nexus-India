"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  EmailContextType,
  EmailMessage,
  EmailThread,
} from "@/lib/email/index";

export interface ContextThread extends EmailThread {
  messages: EmailMessage[];
}

interface Params {
  contextType: EmailContextType;
  contextId: string;
  accountId?: string;
}

const qk = (p: Params) => [
  "email-context",
  p.contextType,
  p.contextId,
  p.accountId ?? "any",
];

export function useContextEmails(p: Params) {
  const qc = useQueryClient();
  const sb = createClient();

  const query = useQuery({
    queryKey: qk(p),
    queryFn: async (): Promise<ContextThread[]> => {
      const { data: ctxs, error } = await sb
        .from("email_contexts")
        .select(
          `
          thread_id,
          email_threads!inner (
            id, account_id, subject, participants, last_message_at,
            message_count, unread_count, snippet, gmail_thread_id,
            created_at, org_id, lead_id
          )
        `,
        )
        .eq("context_type", p.contextType)
        .eq("context_id", p.contextId);
      if (error) throw error;

      type CtxRow = {
        thread_id: string;
        email_threads: EmailThread | EmailThread[];
      };
      const rows = (ctxs ?? []) as unknown as CtxRow[];
      const threadIds = Array.from(new Set(rows.map((r) => r.thread_id)));
      if (threadIds.length === 0) return [];

      const { data: msgs } = await sb
        .from("email_messages")
        .select("*")
        .in("thread_id", threadIds)
        .order("sent_at", { ascending: true, nullsFirst: false });

      const threads: EmailThread[] = rows.map((r) =>
        Array.isArray(r.email_threads) ? r.email_threads[0] : r.email_threads,
      );
      const byThread: Record<string, EmailMessage[]> = {};
      for (const m of (msgs ?? []) as EmailMessage[]) {
        (byThread[m.thread_id] ??= []).push(m);
      }
      return threads
        .map((t) => ({ ...t, messages: byThread[t.id] ?? [] }))
        .sort((a, b) =>
          (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
        );
    },
  });

  useEffect(() => {
    const channel = sb
      .channel(`email-ctx-${p.contextType}-${p.contextId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_messages" },
        () => qc.invalidateQueries({ queryKey: qk(p) }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_contexts",
          filter: `context_id=eq.${p.contextId}`,
        },
        () => qc.invalidateQueries({ queryKey: qk(p) }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.contextType, p.contextId, p.accountId]);

  return query;
}
