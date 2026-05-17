"use client";

import { useState } from "react";
import { useContextEmails } from "@/lib/email/use-context-emails";
import { ContextEmailList } from "./ContextEmailList";
import { ContextEmailReply } from "./ContextEmailReply";
import type { EmailContextType } from "@/lib/email/index";

interface Props {
  contextType: EmailContextType;
  contextId: string;
  defaultRecipient?: string;
  onSent?: (threadId: string) => void;
}

export function ContextEmailPanel({
  contextType,
  contextId,
  defaultRecipient,
  onSent,
}: Props) {
  const { data, isLoading } = useContextEmails({ contextType, contextId });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const threads = data ?? [];
  const selected = threads.find((t) => t.id === selectedId) ?? threads[0];

  return (
    <div className="flex h-full border border-border rounded-lg overflow-hidden">
      <aside className="w-72 border-r border-border overflow-y-auto bg-background">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ContextEmailList
            threads={threads}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        )}
      </aside>
      <main className="flex-1 flex flex-col bg-background">
        {selected ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 className="font-semibold">
                {selected.subject ?? "(no subject)"}
              </h3>
              {selected.messages.map((m) => (
                <article
                  key={m.id}
                  className="border-l-2 border-muted pl-3"
                >
                  <header className="flex justify-between text-xs text-muted-foreground">
                    <span>{m.from_email}</span>
                    <span>
                      {m.sent_at
                        ? new Date(m.sent_at).toLocaleString()
                        : ""}
                    </span>
                  </header>
                  <div
                    className="prose prose-sm max-w-none mt-2"
                    dangerouslySetInnerHTML={{ __html: m.body_html ?? "" }}
                  />
                </article>
              ))}
            </div>
            <ContextEmailReply
              thread={selected}
              defaultRecipient={defaultRecipient}
              contextType={contextType}
              contextId={contextId}
              onSent={() => onSent?.(selected.id)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No emails linked yet. Replies will appear here automatically.
          </div>
        )}
      </main>
    </div>
  );
}
