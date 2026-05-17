"use client";

// Universal Inbox — Gmail OAuth + IMAP threads in one view.
// Subscribes to Supabase Realtime for live updates from sync workers + send pipeline.
// Force dynamic — this page reads live DB state, no static prerender possible.

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { ContextEmailReply } from "@/components/email/ContextEmailReply";
import type { EmailMessage, EmailThread } from "@/lib/email/index";

interface ThreadWithMessages extends EmailThread {
  messages: EmailMessage[];
}

interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  provider: "smtp_imap" | "gmail_oauth";
  status: string;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#9CA3AF",
};

export default function InboxPage() {
  const sb = createClient();
  const qc = useQueryClient();
  const [accountFilter, setAccountFilter] = useState<string | "all">("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    null,
  );

  const accountsQ = useQuery({
    queryKey: ["email-accounts"],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data } = await sb
        .from("email_accounts")
        .select("id, email, display_name, provider, status")
        .eq("status", "connected")
        .order("email");
      return (data ?? []) as AccountRow[];
    },
  });

  const threadsQ = useQuery({
    queryKey: ["inbox-threads", accountFilter],
    queryFn: async (): Promise<ThreadWithMessages[]> => {
      let q = sb
        .from("email_threads")
        .select("*, email_messages!inner(*)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (accountFilter !== "all") q = q.eq("account_id", accountFilter);
      const { data, error } = await q;
      if (error) throw error;
      type Row = EmailThread & { email_messages: EmailMessage[] };
      return ((data ?? []) as unknown as Row[]).map((t) => ({
        ...t,
        messages: (t.email_messages ?? []).sort(
          (a: EmailMessage, b: EmailMessage) =>
            (a.sent_at ?? a.created_at).localeCompare(
              b.sent_at ?? b.created_at,
            ),
        ),
      }));
    },
  });

  const selected = useMemo(
    () =>
      (threadsQ.data ?? []).find((t) => t.id === selectedThreadId) ?? null,
    [threadsQ.data, selectedThreadId],
  );

  useEffect(() => {
    const channel = sb
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_messages" },
        () => qc.invalidateQueries({ queryKey: ["inbox-threads"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_threads" },
        () => qc.invalidateQueries({ queryKey: ["inbox-threads"] }),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accounts = accountsQ.data ?? [];
  const threads = threadsQ.data ?? [];

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 60px)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Account rail */}
      <aside
        style={{
          width: 200,
          borderRight: "1px solid #E5E7EB",
          padding: 16,
          background: "white",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.gray,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            marginBottom: 10,
          }}
        >
          Accounts
        </div>
        <button
          onClick={() => setAccountFilter("all")}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "6px 8px",
            borderRadius: 6,
            border: "none",
            background: accountFilter === "all" ? "#F0F4FF" : "transparent",
            color: C.navy,
            fontWeight: accountFilter === "all" ? 700 : 500,
            fontSize: 12,
            fontFamily: "inherit",
            cursor: "pointer",
            marginBottom: 2,
          }}
        >
          All
        </button>
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => setAccountFilter(a.id)}
            title={`${a.email} (${a.provider})`}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              background:
                accountFilter === a.id ? "#F0F4FF" : "transparent",
              color: C.navy,
              fontWeight: accountFilter === a.id ? 700 : 500,
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
              marginBottom: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {a.display_name}
          </button>
        ))}
      </aside>

      {/* Thread list */}
      <section
        style={{
          width: 380,
          borderRight: "1px solid #E5E7EB",
          overflowY: "auto",
          background: "white",
        }}
      >
        {threadsQ.isLoading && (
          <div style={{ padding: 24, color: C.gray, fontSize: 12 }}>
            Loading…
          </div>
        )}
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedThreadId(t.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              borderBottom: "1px solid #F3F4F6",
              cursor: "pointer",
              background:
                selectedThreadId === t.id ? "#F0F4FF" : "white",
              borderLeft: `3px solid ${
                selectedThreadId === t.id ? C.coral : "transparent"
              }`,
              border: "none",
              borderBottomColor: "#F3F4F6",
              borderBottomStyle: "solid",
              borderBottomWidth: 1,
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.navy,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.subject || "(no subject)"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6B7280",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.participants.slice(0, 2).join(", ")}
            </div>
            <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>
              {t.last_message_at
                ? new Date(t.last_message_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </div>
          </button>
        ))}
        {threadsQ.isFetched && threads.length === 0 && (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: C.gray,
              fontSize: 12,
            }}
          >
            No threads. Connect a mailbox at{" "}
            <a href="/settings/integrations" style={{ color: C.coral }}>
              /settings/integrations
            </a>{" "}
            then wait for sync.
          </div>
        )}
      </section>

      {/* Thread detail */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#FAFAFA",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {selected ? (
          <>
            <header
              style={{
                padding: "20px 28px 14px",
                borderBottom: "1px solid #E5E7EB",
                background: "white",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: C.navy,
                }}
              >
                {selected.subject || "(no subject)"}
              </h2>
              <div
                style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}
              >
                {selected.participants.join(" · ")}
              </div>
            </header>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {selected.messages.map((m) => (
                <article
                  key={m.id}
                  style={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 10,
                    padding: "14px 18px",
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: C.navy,
                      }}
                    >
                      {m.direction === "outbound"
                        ? `→ ${m.from_email ?? "Sent"}`
                        : (m.from_email ?? "Unknown")}
                    </span>
                    <span style={{ fontSize: 11, color: C.gray }}>
                      {m.sent_at
                        ? new Date(m.sent_at).toLocaleString("en-IN")
                        : ""}
                    </span>
                  </header>
                  {m.body_html ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#1F2937",
                        lineHeight: 1.6,
                      }}
                      dangerouslySetInnerHTML={{ __html: m.body_html }}
                    />
                  ) : m.body_text ? (
                    <pre
                      style={{
                        fontSize: 12,
                        color: "#1F2937",
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        margin: 0,
                      }}
                    >
                      {m.body_text}
                    </pre>
                  ) : (
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                      {m.snippet ?? "(no preview)"}
                    </div>
                  )}
                </article>
              ))}
            </div>

            <ContextEmailReply
              thread={selected}
              contextType="none"
              contextId={selected.id}
              defaultRecipient={selected.participants?.find(
                (p) => p && !p.includes(accountsQ.data?.find((a) => a.id === selected.account_id)?.email ?? ""),
              )}
            />
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: C.gray,
              fontSize: 13,
            }}
          >
            Select a thread to view messages.
          </div>
        )}
      </main>
    </div>
  );
}
