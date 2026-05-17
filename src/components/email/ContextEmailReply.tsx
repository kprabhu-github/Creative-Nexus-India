"use client";

import { useState } from "react";
import type { ContextThread } from "@/lib/email/use-context-emails";
import type { EmailContextType } from "@/lib/email/index";

interface Props {
  thread: ContextThread;
  defaultRecipient?: string;
  contextType: EmailContextType;
  contextId: string;
  onSent?: () => void;
}

export function ContextEmailReply({
  thread,
  defaultRecipient,
  contextType,
  contextId,
  onSent,
}: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefer last inbound sender, then last message sender, then explicit
  // default, then first participant on the thread. Always render — if all
  // four are empty, show a recipient input so the user can type one.
  const lastInboundFrom = [...thread.messages]
    .reverse()
    .find((m) => m.direction === "inbound")?.from_email;
  const lastFrom = thread.messages[thread.messages.length - 1]?.from_email;
  const firstParticipant = thread.participants?.[0];
  const resolvedRecipient =
    lastInboundFrom ?? lastFrom ?? defaultRecipient ?? firstParticipant ?? "";
  const [recipient, setRecipient] = useState(resolvedRecipient);

  const send = async () => {
    setSending(true);
    setError(null);
    if (!recipient.trim()) {
      setError("Recipient required");
      setSending(false);
      return;
    }
    try {
      const res = await fetch("/xapi/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          account_id: thread.account_id,
          thread_id: thread.id,
          to: [recipient.trim()],
          subject: thread.subject?.toLowerCase().startsWith("re:")
            ? thread.subject
            : `Re: ${thread.subject ?? ""}`,
          html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
          context_type: contextType,
          context_id: contextId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBody("");
      onSent?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid #E5E7EB",
        padding: "14px 18px",
        background: "white",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            whiteSpace: "nowrap",
          }}
        >
          To
        </span>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="recipient@example.com"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #D1D5DB",
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply…"
        rows={4}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 6,
          border: "1px solid #D1D5DB",
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      {error && (
        <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>{error}</p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={send}
          disabled={sending || !body.trim() || !recipient.trim()}
          style={{
            padding: "8px 18px",
            borderRadius: 7,
            border: "none",
            background: sending || !body.trim() || !recipient.trim() ? "#F3F4F6" : "#FF6B4A",
            color: sending || !body.trim() || !recipient.trim() ? "#9CA3AF" : "white",
            fontSize: 12,
            fontWeight: 700,
            cursor: sending || !body.trim() || !recipient.trim() ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {sending ? "Sending…" : "Send reply →"}
        </button>
      </div>
    </div>
  );
}
