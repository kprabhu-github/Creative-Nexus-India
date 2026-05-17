"use client";

import type { ContextThread } from "@/lib/email/use-context-emails";

interface Props {
  threads: ContextThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ContextEmailList({ threads, selectedId, onSelect }: Props) {
  if (threads.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground">
        No emails linked to this record yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {threads.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => onSelect(t.id)}
            className={`w-full text-left px-4 py-3 hover:bg-muted/50 ${
              selectedId === t.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex justify-between gap-3">
              <p className="text-sm font-medium truncate">
                {t.subject ?? "(no subject)"}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {t.last_message_at
                  ? new Date(t.last_message_at).toLocaleDateString()
                  : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {t.snippet ?? ""}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
