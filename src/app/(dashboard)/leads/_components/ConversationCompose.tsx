"use client";

import { useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { MailboxPicker } from "@/components/email/MailboxPicker";

// HTML-escape user input before converting newlines to <br>. Without this,
// raw <script>/<img onerror=...> would ship into the outbound HTML email.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br>");
}

// ---------------------------------------------------------------------------
// Shared types — re-exported so ConversationsSection can use them
// ---------------------------------------------------------------------------

export interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  snippet: string | null;
  sent_at: string | null;
  is_read: boolean;
  message_id: string | null;
  in_reply_to: string | null;
  references_chain: string[];
}

export interface Thread {
  id: string;
  account_id: string;
  subject: string | null;
  participants: string[];
  last_message_at: string | null;
  message_count: number;
  unread_count: number;
  lead_id: string | null;
  messages: ThreadMessage[];
}

function pickReplyTo(thread: Thread, fallback: string | null): string {
  const lastInbound = [...thread.messages]
    .reverse()
    .find((m) => m.direction === "inbound" && m.from_email);
  if (lastInbound?.from_email) return lastInbound.from_email;
  const other = thread.participants.find((p) => !!p);
  return other ?? fallback ?? "";
}

// ---------------------------------------------------------------------------
// ReplyBox
// ---------------------------------------------------------------------------

interface ReplyBoxProps {
  thread: Thread;
  sortedMessages: ThreadMessage[];
  leadId: string;
  leadEmail: string | null;
  onSent: () => void;
}

export function ReplyBox({
  thread,
  sortedMessages,
  leadId,
  leadEmail,
  onSent,
}: ReplyBoxProps) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subject = thread.subject
    ? thread.subject.startsWith("Re:")
      ? thread.subject
      : `Re: ${thread.subject}`
    : "Re:";

  const toAddress = pickReplyTo(thread, leadEmail);

  const lastInbound = [...sortedMessages]
    .reverse()
    .find((m) => m.direction === "inbound");
  const refParent =
    lastInbound ?? sortedMessages[sortedMessages.length - 1] ?? null;

  const handleSend = async () => {
    if (!accountId) {
      setErr("Pick a mailbox first");
      return;
    }
    if (!body.trim()) {
      setErr("Write a reply first");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/xapi/email/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from_account_id: accountId,
          to: toAddress,
          subject,
          html: bodyToHtml(body),
          text: body,
          thread_id: thread.id,
          in_reply_to: refParent?.message_id ?? undefined,
          references: refParent?.references_chain ?? [],
          lead_id: leadId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBody("");
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-background rounded-[8px] p-2.5 dark:bg-foreground-tertiary/5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-foreground-tertiary uppercase tracking-wider shrink-0">
          From
        </span>
        <MailboxPicker
          selectedAccountId={accountId}
          onSelect={setAccountId}
          storageKey={`leads:reply:account:${thread.id}`}
        />
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-foreground-tertiary">To:</span>
        <span className="text-foreground truncate">{toAddress || "—"}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-foreground-tertiary">Subject:</span>
        <span className="text-foreground truncate">{subject}</span>
      </div>
      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        className="w-full rounded-md border border-border bg-background p-2 text-[12px] text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {err && <div className="text-[11px] text-error">{err}</div>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-white text-[11px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="w-3 h-3" strokeWidth={2} />
          )}
          Send
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewEmailForm
// ---------------------------------------------------------------------------

interface NewEmailFormProps {
  leadId: string;
  leadEmail: string | null;
  onClose: () => void;
  onSent: () => void;
  initialSubject?: string;
  initialBody?: string;
  /** Optional preset CC list (e.g. founders). User can toggle on/off via the
   *  "CC founders" checkbox. */
  ccFounders?: string[];
}

export function NewEmailForm({
  leadId,
  leadEmail,
  onClose,
  onSent,
  initialSubject,
  initialBody,
  ccFounders,
}: NewEmailFormProps) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [to, setTo] = useState(leadEmail ?? "");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [ccOn, setCcOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("leads:compose:ccFounders") === "1";
    } catch {
      return false;
    }
  });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cc =
    ccOn && ccFounders && ccFounders.length > 0 ? ccFounders : undefined;

  const handleSend = async () => {
    if (!accountId) {
      setErr("Pick a mailbox first");
      return;
    }
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setErr("To, subject, and body are required");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/xapi/email/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from_account_id: accountId,
          to,
          ...(cc ? { cc } : {}),
          subject,
          html: bodyToHtml(body),
          text: body,
          lead_id: leadId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const toggleCc = (next: boolean) => {
    setCcOn(next);
    try {
      window.localStorage.setItem(
        "leads:compose:ccFounders",
        next ? "1" : "0",
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-2 border border-divider rounded-[8px] p-3 bg-background-secondary space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground">New email</span>
        <button
          type="button"
          onClick={onClose}
          className="text-foreground-tertiary hover:text-foreground"
          aria-label="Close compose"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-foreground-tertiary uppercase tracking-wider shrink-0">
          From
        </span>
        <MailboxPicker
          selectedAccountId={accountId}
          onSelect={setAccountId}
          storageKey="leads:compose:account"
        />
      </div>
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="to@example.com"
        className="w-full rounded-md border border-border bg-background p-2 text-[12px] text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {ccFounders && ccFounders.length > 0 && (
        <label className="flex items-center gap-2 text-[11px] text-foreground-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ccOn}
            onChange={(e) => toggleCc(e.target.checked)}
            className="w-3.5 h-3.5 accent-accent cursor-pointer"
          />
          <span>
            CC founders ({ccFounders.join(", ")})
          </span>
        </label>
      )}
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full rounded-md border border-border bg-background p-2 text-[12px] text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <textarea
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your email…"
        className="w-full rounded-md border border-border bg-background p-2 text-[12px] text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {err && <div className="text-[11px] text-error">{err}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-md text-[11px] font-medium text-foreground-secondary hover:bg-foreground-tertiary/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-white text-[11px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="w-3 h-3" strokeWidth={2} />
          )}
          Send
        </button>
      </div>
    </div>
  );
}
