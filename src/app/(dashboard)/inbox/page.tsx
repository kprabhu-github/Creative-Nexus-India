"use client";

// Unified inbox — lists threads across all connected accounts.
// Click a thread → fetch messages → click a message → fetch body via IMAP on demand.

import { useCallback, useEffect, useMemo, useState } from "react";

interface Account {
  id: string;
  email: string;
  display_name: string;
  status: string;
}

interface Thread {
  id: string;
  account_id: string;
  subject: string | null;
  participants: string[];
  last_message_at: string | null;
  message_count: number;
  unread_count: number;
  lead_id: string | null;
}

interface Message {
  id: string;
  account_id: string;
  imap_uid: number | null;
  message_id: string | null;
  in_reply_to: string | null;
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  snippet: string | null;
  direction: "inbound" | "outbound";
  is_read: boolean;
  sent_at: string | null;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#9CA3AF",
};

export default function InboxPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [accFilter, setAccFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bodies, setBodies] = useState<Record<string, { html: string | null; text: string | null }>>({});
  const [loadingBody, setLoadingBody] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/xapi/email/accounts");
    const json = (await res.json()) as { data?: { accounts: Account[] } };
    setAccounts(json.data?.accounts ?? []);
  }, []);

  const loadThreads = useCallback(async () => {
    const params = new URLSearchParams();
    if (accFilter !== "all") params.set("account_id", accFilter);
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/xapi/email/threads?${params.toString()}`);
    const json = (await res.json()) as { data?: { threads: Thread[] } };
    setThreads(json.data?.threads ?? []);
  }, [accFilter, search]);

  const loadThread = useCallback(async (t: Thread) => {
    setSelectedThread(t);
    setMessages([]);
    setBodies({});
    setReply("");
    const res = await fetch(`/xapi/email/threads/${t.id}`);
    const json = (await res.json()) as { data?: { messages: Message[] } };
    setMessages(json.data?.messages ?? []);
  }, []);

  const fetchBody = useCallback(async (id: string) => {
    if (bodies[id]) return;
    setLoadingBody(id);
    try {
      const res = await fetch(`/xapi/email/messages/${id}/body`);
      const json = (await res.json()) as { data?: { html: string | null; text: string | null }; error?: string };
      setBodies((b) => ({ ...b, [id]: json.data ?? { html: null, text: json.error ?? "(no body)" } }));
    } finally {
      setLoadingBody(null);
    }
  }, [bodies]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/xapi/cron/email-sync");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadThreads();
      if (selectedThread) await loadThread(selectedThread);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleReply() {
    if (!selectedThread || !reply.trim()) return;
    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    const to = lastInbound?.from_email;
    if (!to) {
      alert("Cannot determine recipient — no inbound message in thread.");
      return;
    }
    setSending(true);
    try {
      const subject = selectedThread.subject?.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject ?? ""}`;
      const refs = [
        ...(lastInbound?.in_reply_to ? [lastInbound.in_reply_to] : []),
        ...(lastInbound?.message_id ? [lastInbound.message_id] : []),
      ];
      const res = await fetch("/xapi/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_account_id: selectedThread.account_id,
          thread_id: selectedThread.id,
          to,
          subject,
          html: `<p>${reply.replace(/\n/g, "<br/>")}</p>`,
          text: reply,
          in_reply_to: lastInbound?.message_id,
          references: refs,
        }),
      });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReply("");
      await loadThread(selectedThread);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => { void loadThreads(); }, [loadThreads]);

  const accountById = useMemo(() => {
    const map: Record<string, Account> = {};
    accounts.forEach((a) => { map[a.id] = a; });
    return map;
  }, [accounts]);

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Left rail: accounts + thread list */}
      <div style={{ width: 380, borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", background: "white" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy }}>
              Inbox {totalUnread > 0 && <span style={{ color: C.coral, fontSize: 14 }}>({totalUnread})</span>}
            </h1>
            <button onClick={handleSync} disabled={syncing} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", color: syncing ? C.gray : C.navy, fontSize: 11, fontWeight: 600, cursor: syncing ? "default" : "pointer", fontFamily: "inherit" }}>
              {syncing ? "Syncing…" : "↻ Sync"}
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject…"
            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={() => setAccFilter("all")} style={{ padding: "3px 9px", borderRadius: 16, border: "1px solid", borderColor: accFilter === "all" ? C.navy : "#E5E7EB", background: accFilter === "all" ? C.navy : "white", color: accFilter === "all" ? "white" : "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              All
            </button>
            {accounts.map((a) => (
              <button key={a.id} onClick={() => setAccFilter(a.id)} style={{ padding: "3px 9px", borderRadius: 16, border: "1px solid", borderColor: accFilter === a.id ? C.navy : "#E5E7EB", background: accFilter === a.id ? C.navy : "white", color: accFilter === a.id ? "white" : "#6B7280", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {a.email.split("@")[0]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {threads.map((t) => {
            const acc = accountById[t.account_id];
            const isSelected = selectedThread?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => loadThread(t)}
                style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", cursor: "pointer", background: isSelected ? "#F0F4FF" : t.unread_count > 0 ? "#FAFAFA" : "white", borderLeft: `3px solid ${isSelected ? C.coral : "transparent"}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: C.gray }}>{acc?.email.split("@")[0] ?? "—"}</span>
                  {t.unread_count > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: C.coral, color: "white" }}>{t.unread_count}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: t.unread_count > 0 ? 700 : 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.subject || "(no subject)"}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.participants.slice(0, 2).join(", ")}
                  {t.participants.length > 2 ? ` +${t.participants.length - 2}` : ""}
                </div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>
                  {t.last_message_at ? new Date(t.last_message_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  {" · "}{t.message_count} message{t.message_count === 1 ? "" : "s"}
                </div>
              </div>
            );
          })}
          {threads.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: C.gray, fontSize: 12 }}>
              No threads. Connect a mailbox at <a href="/settings/integrations" style={{ color: C.coral }}>/settings/integrations</a> and click Sync.
            </div>
          )}
        </div>
      </div>

      {/* Right pane: thread detail */}
      <div style={{ flex: 1, overflowY: "auto", background: "#FAFAFA" }}>
        {selectedThread ? (
          <div style={{ padding: "20px 28px", maxWidth: 820 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.navy }}>
                {selectedThread.subject || "(no subject)"}
              </h2>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                {selectedThread.participants.join(" · ")}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m) => {
                const body = bodies[m.id];
                return (
                  <div key={m.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                          {m.direction === "outbound" ? "→ Sent" : (m.from_email ?? "Unknown")}
                        </span>
                        <span style={{ fontSize: 11, color: C.gray, marginLeft: 8 }}>
                          {m.sent_at ? new Date(m.sent_at).toLocaleString("en-IN") : ""}
                        </span>
                      </div>
                      {!body && m.direction === "inbound" && (
                        <button onClick={() => fetchBody(m.id)} disabled={loadingBody === m.id} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", color: loadingBody === m.id ? C.gray : C.navy, fontSize: 10, fontWeight: 600, cursor: loadingBody === m.id ? "default" : "pointer", fontFamily: "inherit" }}>
                          {loadingBody === m.id ? "Loading…" : "Show body"}
                        </button>
                      )}
                    </div>
                    {body ? (
                      body.html ? (
                        <div style={{ fontSize: 13, color: "#1F2937", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: body.html }} />
                      ) : (
                        <pre style={{ fontSize: 12, color: "#1F2937", whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{body.text ?? "(empty)"}</pre>
                      )
                    ) : (
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{m.snippet || "(no preview)"}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reply box */}
            <div style={{ marginTop: 14, background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.gray, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Reply from {accountById[selectedThread.account_id]?.email ?? "—"}
              </div>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your reply…"
                rows={5}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={handleReply} disabled={sending || !reply.trim()} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: sending || !reply.trim() ? "#F3F4F6" : C.coral, color: sending || !reply.trim() ? C.gray : "white", fontSize: 12, fontWeight: 700, cursor: sending || !reply.trim() ? "default" : "pointer", fontFamily: "inherit" }}>
                  {sending ? "Sending…" : "Send reply →"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.gray, fontSize: 13 }}>
            Select a thread to view messages.
          </div>
        )}
      </div>
    </div>
  );
}
