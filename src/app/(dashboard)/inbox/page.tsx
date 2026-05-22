"use client";

// Universal Inbox — Gmail OAuth + IMAP threads in one view.
// Subscribes to Supabase Realtime for live updates from sync workers + send pipeline.
// Force dynamic — this page reads live DB state, no static prerender possible.

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ComposeModal, type ComposeInitial } from "@/components/email/ComposeModal";
import {
  ThreadHeaderActions,
  ThreadShortcutsPanel,
} from "@/components/email/ThreadActions";
import type { EmailMessage, EmailThread } from "@/lib/email/index";

type Folder = "inbox" | "starred" | "sent" | "archived" | "trash";

const FOLDERS: Array<{ key: Folder; label: string }> = [
  { key: "inbox", label: "Inbox" },
  { key: "starred", label: "Starred" },
  { key: "sent", label: "Sent" },
  { key: "archived", label: "Archived" },
  { key: "trash", label: "Trash" },
];

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
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    null,
  );
  const [compose, setCompose] = useState<ComposeInitial | null>(null);

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
    queryKey: ["inbox-threads", accountFilter, folder],
    queryFn: async (): Promise<ThreadWithMessages[]> => {
      let q = sb
        .from("email_threads")
        .select("*, email_messages!inner(*)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (accountFilter !== "all") q = q.eq("account_id", accountFilter);

      if (folder === "trash") {
        q = q.not("trashed_at", "is", null);
      } else {
        q = q.is("trashed_at", null);
        if (folder === "inbox") q = q.eq("archived", false);
        else if (folder === "archived") q = q.eq("archived", true);
        else if (folder === "starred") q = q.eq("starred", true);
        // "sent" reuses thread list — filtering by outbound-only message
        // happens at render time below.
      }

      const { data, error } = await q;
      if (error) throw error;
      type Row = EmailThread & { email_messages: EmailMessage[] };
      let rows = ((data ?? []) as unknown as Row[]).map((t) => ({
        ...t,
        messages: (t.email_messages ?? []).sort(
          (a: EmailMessage, b: EmailMessage) =>
            (a.sent_at ?? a.created_at).localeCompare(
              b.sent_at ?? b.created_at,
            ),
        ),
      }));
      if (folder === "sent") {
        rows = rows.filter((t) =>
          t.messages.some((m) => m.direction === "outbound"),
        );
      }
      return rows;
    },
  });

  const selected = useMemo(
    () =>
      (threadsQ.data ?? []).find((t) => t.id === selectedThreadId) ?? null,
    [threadsQ.data, selectedThreadId],
  );

  // Optimistic cache patcher: updates the thread row in the React Query cache
  // so the UI reflects the change immediately; the realtime channel will
  // confirm or replace it with server truth.
  const patchCache = (
    threadId: string,
    patch: Partial<{
      starred: boolean;
      archived: boolean;
      read: boolean;
      trashed: boolean;
    }>,
  ) => {
    qc.setQueriesData<ThreadWithMessages[]>(
      { queryKey: ["inbox-threads"] },
      (rows) => {
        if (!rows) return rows;
        return rows
          .map((t) => {
            if (t.id !== threadId) return t;
            return {
              ...t,
              starred: patch.starred ?? t.starred,
              archived: patch.archived ?? t.archived,
              unread_count:
                patch.read === true
                  ? 0
                  : patch.read === false
                    ? Math.max(1, t.unread_count)
                    : t.unread_count,
              trashed_at: patch.trashed ? new Date().toISOString() : t.trashed_at,
            };
          })
          .filter((t) => {
            // Drop rows that no longer belong in the current folder view.
            if (folder === "trash") return t.trashed_at !== null;
            if (t.trashed_at) return false;
            if (folder === "inbox") return !t.archived;
            if (folder === "archived") return t.archived;
            if (folder === "starred") return t.starred;
            return true;
          });
      },
    );
    if (patch.trashed) setSelectedThreadId(null);
  };

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
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
          onClick={() => setCompose({})}
          style={{
            background: C.coral,
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 18,
            boxShadow: "0 2px 8px rgba(255,107,74,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 400 }}>+</span> Compose
        </button>
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
          Folders
        </div>
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFolder(f.key);
              setSelectedThreadId(null);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              background: folder === f.key ? "#F0F4FF" : "transparent",
              color: C.navy,
              fontWeight: folder === f.key ? 700 : 500,
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
              marginBottom: 2,
            }}
          >
            {f.label}
          </button>
        ))}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.gray,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            margin: "18px 0 10px",
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
          <div
            key={t.id}
            style={{
              position: "relative",
              borderBottom: "1px solid #F3F4F6",
              background: selectedThreadId === t.id ? "#F0F4FF" : "white",
              borderLeft: `3px solid ${
                selectedThreadId === t.id ? C.coral : "transparent"
              }`,
            }}
          >
            <button
              onClick={() => setSelectedThreadId(t.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 40px 10px 14px",
                cursor: "pointer",
                background: "transparent",
                border: "none",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: t.unread_count > 0 ? 800 : 600,
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
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                const next = !t.starred;
                patchCache(t.id, { starred: next });
                await fetch(`/xapi/email/threads/${t.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ starred: next }),
                }).catch(() => patchCache(t.id, { starred: !next }));
              }}
              title={t.starred ? "Unstar" : "Star"}
              aria-label={t.starred ? "Unstar thread" : "Star thread"}
              style={{
                position: "absolute",
                right: 8,
                top: 10,
                width: 28,
                height: 28,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                color: t.starred ? "#F59E0B" : "#D1D5DB",
              }}
            >
              <Star
                size={14}
                strokeWidth={1.8}
                fill={t.starred ? "#F59E0B" : "none"}
              />
            </button>
          </div>
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: C.navy,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {selected.subject || "(no subject)"}
                </h2>
                <div
                  style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}
                >
                  {selected.participants.join(" · ")}
                </div>
              </div>
              <ThreadHeaderActions
                threadId={selected.id}
                starred={selected.starred}
                archived={selected.archived}
                unreadCount={selected.unread_count}
                onChange={(patch) => patchCache(selected.id, patch)}
              />
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

            {/* Quick "Reply" trigger — opens the full compose modal */}
            <div
              style={{
                borderTop: "1px solid #E5E7EB",
                padding: "14px 28px",
                background: "white",
                display: "flex",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => {
                  const lastInboundFrom = [...selected.messages]
                    .reverse()
                    .find((m) => m.direction === "inbound")?.from_email;
                  const fallback = selected.participants?.find(
                    (p) =>
                      p &&
                      !p.includes(
                        accountsQ.data?.find((a) => a.id === selected.account_id)
                          ?.email ?? "",
                      ),
                  );
                  setCompose({
                    account_id: selected.account_id,
                    thread_id: selected.id,
                    to: [lastInboundFrom ?? fallback ?? ""].filter(Boolean),
                    subject: selected.subject?.toLowerCase().startsWith("re:")
                      ? selected.subject
                      : `Re: ${selected.subject ?? ""}`,
                  });
                }}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${C.coral}`,
                  background: "white",
                  color: C.coral,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ↩ Reply
              </button>
              <button
                onClick={() => {
                  setCompose({
                    account_id: selected.account_id,
                    to: selected.participants.filter(
                      (p) =>
                        p &&
                        !p.includes(
                          accountsQ.data?.find(
                            (a) => a.id === selected.account_id,
                          )?.email ?? "",
                        ),
                    ),
                    subject: selected.subject ?? "",
                  });
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${C.navy}`,
                  background: "white",
                  color: C.navy,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Forward
              </button>
            </div>
            <ThreadShortcutsPanel
              threadId={selected.id}
              starred={selected.starred}
              archived={selected.archived}
              unreadCount={selected.unread_count}
              onChange={(patch) => patchCache(selected.id, patch)}
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

      {compose && (
        <ComposeModal
          initial={compose}
          onClose={() => setCompose(null)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ["inbox-threads"] });
          }}
        />
      )}
    </div>
  );
}
