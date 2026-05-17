"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  const lastMessage = thread.messages[thread.messages.length - 1];
  const recipient = lastMessage?.from_email ?? defaultRecipient;
  if (!recipient) return null;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          account_id: thread.account_id,
          thread_id: thread.id,
          to: [recipient],
          subject: thread.subject?.startsWith("Re:")
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
    <div className="border-t border-border p-4 space-y-2">
      <p className="text-xs text-muted-foreground">Reply to {recipient}</p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply…"
        rows={4}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={send} disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
