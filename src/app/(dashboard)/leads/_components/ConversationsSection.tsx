"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  Inbox,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import {
  NewEmailForm,
  ReplyBox,
  type Thread,
  type ThreadMessage,
} from "./ConversationCompose";

// ---------------------------------------------------------------------------
// Types — match `/xapi/leads/{id}/threads` response exactly
// ---------------------------------------------------------------------------

interface ThreadsResponse {
  data: { threads: Thread[] };
}

/** External request to open the compose form pre-filled (e.g. from the
 *  toolbar's AI Draft button on LeadDetail). When this prop changes to a
 *  non-null value, the section opens its New Email form with these initial
 *  values. The parent should clear it via `onComposeHandled` after the form
 *  closes or sends, so a future click can re-trigger. */
export interface ComposeRequest {
  subject?: string;
  body?: string;
  ccFounders?: string[];
}

interface ConversationsSectionProps {
  leadId: string;
  leadEmail: string | null;
  onAiDraft?: () => void;
  composeRequest?: ComposeRequest | null;
  onComposeHandled?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// TODO: extract shared timeAgo to a util — currently duplicated in leads/page.tsx
function timeAgo(dateString: string | null): string {
  if (!dateString) return "—";
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ConversationsSection({
  leadId,
  leadEmail,
  onAiDraft,
  composeRequest,
  onComposeHandled,
}: ConversationsSectionProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Open the compose form when a parent triggers it (e.g. AI Draft toolbar).
  useEffect(() => {
    if (composeRequest) setComposeOpen(true);
  }, [composeRequest]);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    if (composeRequest && onComposeHandled) onComposeHandled();
  }, [composeRequest, onComposeHandled]);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/xapi/leads/${leadId}/threads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ThreadsResponse;
      const list = json?.data?.threads ?? [];
      setThreads(list);
      if (list.length > 0) {
        setExpandedIds(new Set([list[0].id]));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  const toggleThread = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bt - at;
    });
  }, [threads]);

  const visibleThreads = showAll ? sortedThreads : sortedThreads.slice(0, 4);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <Inbox className="w-3.5 h-3.5" strokeWidth={2} />
          Conversations ({threads.length})
        </span>
        <div className="flex items-center gap-1.5">
          {onAiDraft && (
            <button
              type="button"
              onClick={onAiDraft}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/10 text-accent text-[11px] font-medium hover:bg-accent/15 transition-colors"
            >
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              AI Draft
            </button>
          )}
          <button
            type="button"
            onClick={() => setComposeOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-white text-[11px] font-medium hover:bg-accent/90 transition-colors"
          >
            <Mail className="w-3 h-3" strokeWidth={2} />
            New email
          </button>
        </div>
      </div>

      {toast && (
        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-success/10 text-success text-[11px] font-medium">
          <CheckCircle className="w-3 h-3" strokeWidth={2} />
          {toast}
        </div>
      )}

      {composeOpen && (
        <NewEmailForm
          leadId={leadId}
          leadEmail={leadEmail}
          initialSubject={composeRequest?.subject}
          initialBody={composeRequest?.body}
          ccFounders={composeRequest?.ccFounders}
          onClose={closeCompose}
          onSent={() => {
            setComposeOpen(false);
            if (composeRequest && onComposeHandled) onComposeHandled();
            flashToast("Email sent");
            void fetchThreads();
          }}
        />
      )}

      <div className="mt-2">
        {loading ? (
          <div className="flex items-center gap-1.5 text-[12px] text-foreground-tertiary py-3">
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
            Loading conversations…
          </div>
        ) : error ? (
          <div className="text-[12px] text-error py-2">{error}</div>
        ) : sortedThreads.length === 0 ? (
          <div className="bg-background rounded-[8px] p-4 dark:bg-foreground-tertiary/5 text-center">
            <Mail
              className="w-5 h-5 text-foreground-tertiary mx-auto mb-1.5"
              strokeWidth={1.5}
            />
            <p className="text-[12px] text-foreground-tertiary">
              No conversations yet. Send the first email to start one.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleThreads.map((t) => (
              <ThreadCard
                key={t.id}
                thread={t}
                expanded={expandedIds.has(t.id)}
                onToggle={() => toggleThread(t.id)}
                leadId={leadId}
                leadEmail={leadEmail}
                onSent={() => {
                  flashToast("Reply sent");
                  void fetchThreads();
                }}
              />
            ))}
            {!showAll && sortedThreads.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-[12px] text-accent hover:underline"
              >
                View all ({sortedThreads.length}) threads
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadCard — collapsed summary or expanded timeline + reply box
// ---------------------------------------------------------------------------

interface ThreadCardProps {
  thread: Thread;
  expanded: boolean;
  onToggle: () => void;
  leadId: string;
  leadEmail: string | null;
  onSent: () => void;
}

function ThreadCard({
  thread,
  expanded,
  onToggle,
  leadId,
  leadEmail,
  onSent,
}: ThreadCardProps) {
  const sortedMessages = useMemo(() => {
    return [...thread.messages].sort((a, b) => {
      const at = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const bt = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return at - bt;
    });
  }, [thread.messages]);

  const lastMsg =
    sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1] : null;

  return (
    <div className="border border-divider rounded-[8px] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 p-3 text-left hover:bg-background-secondary transition-colors"
      >
        <span className="mt-0.5 text-foreground-tertiary">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">
              {thread.subject || "(no subject)"}
            </span>
            {thread.unread_count > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-accent text-white text-[10px] font-semibold">
                {thread.unread_count} new
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-md bg-foreground-tertiary/5 text-foreground-tertiary text-[10px] font-medium">
              {thread.message_count} msg
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-tertiary">
            <span className="truncate">{lastMsg?.snippet ?? ""}</span>
            <span className="shrink-0">{timeAgo(thread.last_message_at)}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-divider bg-background-secondary p-3 space-y-2">
          {sortedMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <ReplyBox
            thread={thread}
            sortedMessages={sortedMessages}
            leadId={leadId}
            leadEmail={leadEmail}
            onSent={onSent}
          />
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  const isOutbound = message.direction === "outbound";
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-[10px] p-2.5 ${
          isOutbound
            ? "bg-accent/10 text-foreground"
            : "bg-background dark:bg-foreground-tertiary/5"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] font-medium text-foreground-secondary truncate">
            {message.from_email ?? (isOutbound ? "you" : "unknown")}
          </span>
          <span className="text-[10px] text-foreground-tertiary shrink-0">
            {timeAgo(message.sent_at)}
          </span>
        </div>
        <p className="text-[12px] text-foreground whitespace-pre-wrap break-words">
          {message.snippet ?? ""}
        </p>
      </div>
    </div>
  );
}

export default ConversationsSection;
export { ConversationsSection };
