"use client";

// Gmail-style floating compose. Bottom-right of screen, minimizable, closable,
// fullscreen-toggleable. Rich text body (Tiptap), recipient chips with
// autocomplete from past senders, keyboard shortcuts (⌘↵ send, Esc minimize).
// Used for new emails and replies. Sends via /xapi/email/send.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { EmailContextType } from "@/lib/email/index";
import { RichTextEditor } from "./RichTextEditor";
import { RecipientChips } from "./RecipientChips";

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
  err: "#EF4444",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [to, setTo] = useState<string[]>(initial?.to ?? []);
  const [cc, setCc] = useState<string[]>(initial?.cc ?? []);
  const [bcc, setBcc] = useState<string[]>(initial?.bcc ?? []);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean(initial?.cc?.length || initial?.bcc?.length),
  );
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendRef = useRef<() => void>(() => {});

  // Default account = first connected one.
  useEffect(() => {
    if (!accountId && accountsQ.data?.length) {
      setAccountId(accountsQ.data[0].id);
    }
  }, [accountId, accountsQ.data]);

  const send = async () => {
    setError(null);
    if (!accountId) return setError("Pick a From account");
    if (to.length === 0) return setError("At least one recipient required");
    const invalid = [...to, ...(showCcBcc ? cc : []), ...(showCcBcc ? bcc : [])].filter(
      (e) => !EMAIL_RE.test(e),
    );
    if (invalid.length) return setError(`Invalid email: ${invalid[0]}`);
    if (!subject.trim()) return setError("Subject required");
    const plain = htmlToText(body).trim();
    if (!plain) return setError("Body required");

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
          to,
          cc: showCcBcc && cc.length ? cc : undefined,
          bcc: showCcBcc && bcc.length ? bcc : undefined,
          subject: subject.trim(),
          html: body,
          context_type: initial?.context_type,
          context_id: initial?.context_id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message_id?: string;
        thread_id?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSent?.(json.message_id ?? "", json.thread_id ?? "");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Keep latest send in ref so shortcut handler stays stable.
  useEffect(() => {
    sendRef.current = send;
  });

  // Global keyboard shortcuts: Esc = minimize, ⌘/Ctrl+Enter = send.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !minimized) {
        const tgt = e.target as HTMLElement | null;
        if (tgt?.tagName === "INPUT" || tgt?.tagName === "SELECT") return;
        e.preventDefault();
        setMinimized(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        sendRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minimized]);

  const canSend = !sending && to.length > 0 && !!subject.trim() && accountId;

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

  const frameStyle: React.CSSProperties = fullscreen
    ? {
        position: "fixed",
        inset: "40px 40px 0 40px",
        width: "auto",
        maxWidth: 980,
        margin: "0 auto",
        maxHeight: "calc(100vh - 40px)",
        background: "white",
        borderRadius: "12px 12px 0 0",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 9999,
        border: `1px solid ${C.border}`,
      }
    : {
        position: "fixed",
        bottom: 0,
        right: 20,
        width: 560,
        maxHeight: "85vh",
        background: "white",
        borderRadius: "10px 10px 0 0",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 9999,
        border: `1px solid ${C.border}`,
      };

  return (
    <div style={frameStyle}>
      {/* Header */}
      <header
        style={{
          background: C.navy,
          color: "white",
          padding: "10px 16px",
          borderRadius: fullscreen ? "12px 12px 0 0" : "10px 10px 0 0",
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
            onClick={() => setFullscreen((f) => !f)}
            style={iconBtn}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? "⤡" : "⤢"}
          </button>
          <button
            onClick={() => setMinimized(true)}
            style={iconBtn}
            title="Minimize (Esc)"
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
        <RecipientChips
          value={to}
          onChange={setTo}
          placeholder="Recipients"
          autoFocus={!initial?.to?.length}
        />
        {!showCcBcc && (
          <button
            onClick={() => setShowCcBcc(true)}
            style={inlineLink}
            type="button"
          >
            Cc · Bcc
          </button>
        )}
      </div>

      {/* Cc / Bcc */}
      {showCcBcc && (
        <>
          <div style={fieldRow}>
            <label style={fieldLabel}>Cc</label>
            <RecipientChips value={cc} onChange={setCc} placeholder="Cc" />
          </div>
          <div style={fieldRow}>
            <label style={fieldLabel}>Bcc</label>
            <RecipientChips value={bcc} onChange={setBcc} placeholder="Bcc" />
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
      <div
        style={{
          flex: 1,
          padding: "10px 16px 12px",
          display: "flex",
          flexDirection: "column",
          minHeight: 220,
          overflow: "hidden",
        }}
      >
        <RichTextEditor
          value={body}
          onChange={setBody}
          onCmdEnter={send}
          minHeight={fullscreen ? 380 : 220}
          placeholder="Write your message…"
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={send}
            disabled={!canSend}
            style={{
              padding: "9px 22px",
              borderRadius: 7,
              border: "none",
              background: !canSend ? "#F3F4F6" : C.coral,
              color: !canSend ? C.gray : "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: !canSend ? "default" : "pointer",
              fontFamily: "inherit",
            }}
            title="Send (⌘↵)"
          >
            {sending ? "Sending…" : "Send"}
          </button>
          <span style={{ fontSize: 11, color: C.gray }}>⌘↵ to send · Esc to minimize</span>
        </div>
        {error && (
          <span style={{ fontSize: 11, color: C.err, marginLeft: 12, textAlign: "right" }}>
            {error}
          </span>
        )}
      </footer>
    </div>
  );
}

function htmlToText(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? "";
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
  alignItems: "flex-start",
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
  paddingTop: 5,
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

const inlineLink: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: C.gray,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  padding: "4px 6px",
  whiteSpace: "nowrap",
  alignSelf: "center",
};
