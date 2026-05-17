"use client";

// Gmail-style floating compose. Bottom-right of screen, minimizable, closable.
// Used for both new emails (open from "+ Compose") and replies (pre-fills
// recipient, subject, thread_id, in_reply_to). Sends via /xapi/email/send.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { EmailContextType } from "@/lib/email/index";

interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  provider: "smtp_imap" | "gmail_oauth";
}

export interface ComposeInitial {
  account_id?: string;
  thread_id?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  context_type?: EmailContextType;
  context_id?: string;
}

interface Props {
  initial?: ComposeInitial;
  onClose: () => void;
  onSent?: (messageId: string, threadId: string) => void;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#9CA3AF",
  border: "#E5E7EB",
  bg: "#FAFAFA",
};

export function ComposeModal({ initial, onClose, onSent }: Props) {
  const sb = useMemo(() => createClient(), []);

  const accountsQ = useQuery({
    queryKey: ["email-accounts-compose"],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data } = await sb
        .from("email_accounts")
        .select("id, email, display_name, provider")
        .eq("status", "connected")
        .order("email");
      return (data ?? []) as AccountRow[];
    },
  });

  const [accountId, setAccountId] = useState(initial?.account_id ?? "");
  const [to, setTo] = useState((initial?.to ?? []).join(", "));
  const [cc, setCc] = useState((initial?.cc ?? []).join(", "));
  const [bcc, setBcc] = useState((initial?.bcc ?? []).join(", "));
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean(initial?.cc?.length || initial?.bcc?.length),
  );
  const [minimized, setMinimized] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default account = first connected one.
  useEffect(() => {
    if (!accountId && accountsQ.data?.length) {
      setAccountId(accountsQ.data[0].id);
    }
  }, [accountId, accountsQ.data]);

  const splitEmails = (raw: string): string[] =>
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const send = async () => {
    setError(null);
    const toList = splitEmails(to);
    if (!accountId) {
      setError("Pick a From account");
      return;
    }
    if (toList.length === 0) {
      setError("At least one recipient required");
      return;
    }
    if (!subject.trim()) {
      setError("Subject required");
      return;
    }
    if (!body.trim()) {
      setError("Body required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/xapi/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          account_id: accountId,
          thread_id: initial?.thread_id,
          to: toList,
          cc: showCcBcc && cc ? splitEmails(cc) : undefined,
          bcc: showCcBcc && bcc ? splitEmails(bcc) : undefined,
          subject: subject.trim(),
          html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
          context_type: initial?.context_type,
          context_id: initial?.context_id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message_id?: string;
        thread_id?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      onSent?.(json.message_id ?? "", json.thread_id ?? "");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (minimized) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: 20,
          width: 320,
          background: C.navy,
          color: "white",
          borderRadius: "8px 8px 0 0",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.15)",
          cursor: "pointer",
          zIndex: 9999,
        }}
        onClick={() => setMinimized(false)}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {subject || "New email"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(false);
            }}
            style={iconBtn}
            title="Expand"
          >
            ▢
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={iconBtn}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 20,
        width: 540,
        maxHeight: "85vh",
        background: "white",
        borderRadius: "10px 10px 0 0",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 9999,
        border: `1px solid ${C.border}`,
      }}
    >
      {/* Header */}
      <header
        style={{
          background: C.navy,
          color: "white",
          padding: "10px 16px",
          borderRadius: "10px 10px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          {initial?.thread_id ? `Re: ${initial?.subject ?? ""}` : "New email"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMinimized(true)}
            style={iconBtn}
            title="Minimize"
          >
            ─
          </button>
          <button onClick={onClose} style={iconBtn} title="Close">
            ✕
          </button>
        </div>
      </header>

      {/* From */}
      <div style={fieldRow}>
        <label style={fieldLabel}>From</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          style={{ ...fieldInput, cursor: "pointer" }}
          disabled={!accountsQ.data?.length}
        >
          {(accountsQ.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name} &lt;{a.email}&gt;
            </option>
          ))}
          {!accountsQ.data?.length && <option>No connected accounts</option>}
        </select>
      </div>

      {/* To */}
      <div style={fieldRow}>
        <label style={fieldLabel}>To</label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="comma-separated emails"
          style={fieldInput}
        />
        {!showCcBcc && (
          <button
            onClick={() => setShowCcBcc(true)}
            style={{
              border: "none",
              background: "transparent",
              color: C.gray,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            Cc · Bcc
          </button>
        )}
      </div>

      {/* Cc */}
      {showCcBcc && (
        <>
          <div style={fieldRow}>
            <label style={fieldLabel}>Cc</label>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="comma-separated"
              style={fieldInput}
            />
          </div>
          <div style={fieldRow}>
            <label style={fieldLabel}>Bcc</label>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="comma-separated"
              style={fieldInput}
            />
          </div>
        </>
      )}

      {/* Subject */}
      <div style={fieldRow}>
        <label style={fieldLabel}>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line"
          style={{ ...fieldInput, fontWeight: 600 }}
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "10px 16px", display: "flex", flexDirection: "column", minHeight: 200 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          style={{
            flex: 1,
            minHeight: 200,
            padding: 10,
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: "inherit",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: C.bg,
          borderRadius: "0 0 0 0",
        }}
      >
        <button
          onClick={send}
          disabled={sending || !body.trim() || !to.trim() || !accountId}
          style={{
            padding: "9px 22px",
            borderRadius: 7,
            border: "none",
            background:
              sending || !body.trim() || !to.trim() || !accountId
                ? "#F3F4F6"
                : C.coral,
            color:
              sending || !body.trim() || !to.trim() || !accountId
                ? C.gray
                : "white",
            fontSize: 13,
            fontWeight: 700,
            cursor:
              sending || !body.trim() || !to.trim() || !accountId
                ? "default"
                : "pointer",
            fontFamily: "inherit",
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
        {error && (
          <span style={{ fontSize: 11, color: "#EF4444", flex: 1, marginLeft: 12 }}>
            {error}
          </span>
        )}
      </footer>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "white",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  width: 22,
  height: 22,
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const fieldRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  borderBottom: `1px solid ${C.border}`,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.gray,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  width: 48,
  flexShrink: 0,
};

const fieldInput: React.CSSProperties = {
  flex: 1,
  padding: "6px 8px",
  border: "none",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  background: "transparent",
  color: C.navy,
};
