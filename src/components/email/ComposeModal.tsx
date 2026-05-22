"use client";

// Gmail-style floating compose. Bottom-right of screen, minimizable, closable,
// fullscreen-toggleable. Rich text body (Tiptap), recipient chips with
// autocomplete from past senders, keyboard shortcuts (⌘↵ send, Esc minimize),
// drag-drop attachments, per-account signature auto-append, draft autosave.
// Used for new emails and replies. Sends via /xapi/email/send.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { EmailContextType } from "@/lib/email/index";
import { RichTextEditor } from "./RichTextEditor";
import { RecipientChips } from "./RecipientChips";
import {
  AttachmentList,
  type AttachmentListHandle,
  type UploadedAttachment,
} from "./AttachmentList";
import {
  useDraftAutosave,
  loadDraft,
  clearDraft,
  buildDraftKey,
} from "./useDraftAutosave";

interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  provider: "smtp_imap" | "gmail_oauth";
  signature_html: string | null;
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

// Signature is appended once per account. We wrap it in a marker div so swapping
// accounts can replace the previous signature instead of stacking them.
const SIG_MARKER_CLASS = "cnx-sig-block";
const SIG_OPEN = `<div class="${SIG_MARKER_CLASS}">`;
const SIG_CLOSE = `</div>`;

function wrapSignature(sig: string): string {
  return `<p></p><p></p>${SIG_OPEN}${sig}${SIG_CLOSE}`;
}

function stripSignature(html: string): string {
  if (!html.includes(SIG_MARKER_CLASS)) return html;
  const re = new RegExp(
    `<div class="${SIG_MARKER_CLASS}">[\\s\\S]*?<\\/div>`,
    "g",
  );
  return html.replace(re, "").replace(/(<p><\/p>)+$/g, "");
}

export function ComposeModal({ initial, onClose, onSent }: Props) {
  const sb = useMemo(() => createClient(), []);

  const accountsQ = useQuery({
    queryKey: ["email-accounts-compose"],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data } = await sb
        .from("email_accounts")
        .select("id, email, display_name, provider, signature_html")
        .eq("status", "connected")
        .order("email");
      return (data ?? []) as AccountRow[];
    },
  });

  const draftKey = useMemo(
    () =>
      buildDraftKey({
        accountId: initial?.account_id,
        threadId: initial?.thread_id,
        contextType: initial?.context_type,
        contextId: initial?.context_id,
      }),
    [
      initial?.account_id,
      initial?.thread_id,
      initial?.context_type,
      initial?.context_id,
    ],
  );

  // Restore draft on mount if present; otherwise use the prefill from `initial`.
  const restored = useMemo(() => loadDraft(draftKey), [draftKey]);

  const [accountId, setAccountId] = useState(initial?.account_id ?? "");
  const [to, setTo] = useState<string[]>(restored?.to ?? initial?.to ?? []);
  const [cc, setCc] = useState<string[]>(restored?.cc ?? initial?.cc ?? []);
  const [bcc, setBcc] = useState<string[]>(restored?.bcc ?? initial?.bcc ?? []);
  const [subject, setSubject] = useState(
    restored?.subject ?? initial?.subject ?? "",
  );
  const [body, setBody] = useState(restored?.body ?? initial?.body ?? "");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean(initial?.cc?.length || initial?.bcc?.length),
  );
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSigEditor, setShowSigEditor] = useState(false);
  const [sigDraft, setSigDraft] = useState("");
  const [savingSig, setSavingSig] = useState(false);

  const sendRef = useRef<() => void>(() => {});
  const attachRef = useRef<AttachmentListHandle | null>(null);
  const sigInitialized = useRef(false);

  // Default account = first connected one.
  useEffect(() => {
    if (!accountId && accountsQ.data?.length) {
      setAccountId(accountsQ.data[0].id);
    }
  }, [accountId, accountsQ.data]);

  // Append signature once on first new compose with an empty body. Replies
  // (initial.thread_id) inherit the parent's signature in the quoted block.
  useEffect(() => {
    if (sigInitialized.current) return;
    if (initial?.thread_id) {
      sigInitialized.current = true;
      return;
    }
    if (restored) {
      sigInitialized.current = true;
      return;
    }
    if (!accountId || !accountsQ.data) return;

    const acct = accountsQ.data.find((a) => a.id === accountId);
    const sig = acct?.signature_html?.trim();
    if (sig) {
      setBody((curr) => {
        if (curr && curr.replace(/<[^>]*>/g, "").trim()) return curr;
        return wrapSignature(sig);
      });
    }
    sigInitialized.current = true;
  }, [accountId, accountsQ.data, initial?.thread_id, restored]);

  // Swap signature when From account changes (only on new compose).
  useEffect(() => {
    if (!sigInitialized.current) return;
    if (initial?.thread_id) return;
    if (!accountId || !accountsQ.data) return;
    const acct = accountsQ.data.find((a) => a.id === accountId);
    const sig = acct?.signature_html?.trim();
    setBody((curr) => {
      const without = stripSignature(curr);
      if (sig) return without + wrapSignature(sig);
      return without;
    });
  }, [accountId, accountsQ.data, initial?.thread_id]);

  useDraftAutosave({
    key: draftKey,
    enabled: !sending,
    state: { to, cc, bcc, subject, body },
  });

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
          attachments: attachments.length ? attachments : undefined,
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
      clearDraft(draftKey);
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

  const openSigEditor = () => {
    const current = accountsQ.data?.find((a) => a.id === accountId);
    setSigDraft(current?.signature_html ?? "");
    setShowSigEditor(true);
  };

  const saveSignature = async () => {
    if (!accountId) return;
    setSavingSig(true);
    try {
      const res = await fetch(`/xapi/email/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_html: sigDraft }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await accountsQ.refetch();
      // Re-apply the new signature to the open draft.
      const trimmed = sigDraft.trim();
      setBody((curr) => {
        const without = stripSignature(curr);
        return trimmed ? without + wrapSignature(trimmed) : without;
      });
      setShowSigEditor(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingSig(false);
    }
  };

  const canSend =
    !sending && to.length > 0 && !!subject.trim() && Boolean(accountId);

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
        <button onClick={openSigEditor} style={inlineLink} type="button">
          Signature
        </button>
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

      {/* Attachments */}
      <AttachmentList
        ref={attachRef}
        attachments={attachments}
        onChange={setAttachments}
      />

      {/* Inline signature editor */}
      {showSigEditor && (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${C.border}`,
            background: "#FAFAFA",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.gray,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: 6,
            }}
          >
            Edit signature
          </div>
          <RichTextEditor
            value={sigDraft}
            onChange={setSigDraft}
            placeholder="Your signature (HTML)…"
            minHeight={100}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={saveSignature}
              disabled={savingSig}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: savingSig ? "#F3F4F6" : C.coral,
                color: savingSig ? C.gray : "white",
                fontSize: 12,
                fontWeight: 700,
                cursor: savingSig ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {savingSig ? "Saving…" : "Save signature"}
            </button>
            <button
              onClick={() => setShowSigEditor(false)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: "white",
                color: C.navy,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <button
            type="button"
            onClick={() => {
              clearDraft(draftKey);
              onClose();
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.gray,
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: 4,
            }}
            title="Discard draft and close"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => attachRef.current?.openPicker()}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.gray,
              fontSize: 18,
              padding: "4px 6px",
              borderRadius: 4,
            }}
            title="Attach files"
          >
            📎
          </button>
          <span style={{ fontSize: 11, color: C.gray }}>
            ⌘↵ send · Esc minimize · drag files to attach
          </span>
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
