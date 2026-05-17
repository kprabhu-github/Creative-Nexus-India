"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const ConversationsSection = dynamic(
  () => import("./_components/ConversationsSection"),
  {
    ssr: false,
    loading: () => (
      <div className="text-[12px] text-foreground-tertiary">
        Loading conversations…
      </div>
    ),
  }
);

import type { ComposeRequest } from "./_components/ConversationsSection";
import {
  Globe,
  CheckCircle,
  AlertCircle,
  Mail,
  ShieldX,
  Search,
  RefreshCw,
  Phone,
  ExternalLink,
  Loader2,
  Inbox,
  Sparkles,
  Ban,
  Clock,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContextEmailPanel } from "@/components/email/ContextEmailPanel";
import { createClient } from "@/lib/supabase/client";
import {
  LeadScore,
  LeadEmail,
  LeadFollowup,
  LeadData,
  EmailType,
  LEAD_THRESHOLDS,
} from "@/lib/leads/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScoreFilter = "all" | "qualified" | "review" | "spam";

interface MergedLead extends LeadData {
  score?: LeadScore;
  emails: LeadEmail[];
  followups: LeadFollowup[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateString: string): string {
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

function scoreColor(score: number): "success" | "warning" | "error" {
  if (score >= LEAD_THRESHOLDS.autoSend) return "success";
  if (score >= LEAD_THRESHOLDS.review) return "warning";
  return "error";
}

function emailStatusLabel(lead: MergedLead): {
  text: string;
  type: "success" | "warning" | "error";
} {
  if (lead.score?.status === "qualified") return { text: "Replied", type: "success" };
  if (lead.score?.spam) return { text: "Blocked", type: "error" };
  const sentEmail = lead.emails.find((e) => e.status === "sent");
  if (sentEmail) return { text: "Email sent", type: "success" };
  const draftEmail = lead.emails.find(
    (e) => e.status === "draft" || e.status === "queued"
  );
  if (draftEmail) return { text: "Draft ready", type: "warning" };
  return { text: "Pending review", type: "warning" };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-foreground-tertiary/10 ${className ?? ""}`}
    />
  );
}

function MetricCardSkeleton() {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <SkeletonBlock className="h-3 w-20 mb-2" />
      <SkeletonBlock className="h-7 w-28 mb-1" />
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}

function LeadListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-3">
          <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1">
            <SkeletonBlock className="h-3.5 w-32 mb-1.5" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
          <SkeletonBlock className="h-5 w-10" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Pill
// ---------------------------------------------------------------------------

function FilterPill({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? `${color} ring-1 ring-current/20`
          : "text-foreground-tertiary hover:text-foreground-secondary bg-transparent"
      }`}
    >
      {label}
      <span
        className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${
          active
            ? "bg-white/20 text-current"
            : "bg-foreground-tertiary/10 text-foreground-tertiary"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Left Panel: Lead List Item
// ---------------------------------------------------------------------------

function LeadListItem({
  lead,
  selected,
  onClick,
}: {
  lead: MergedLead;
  selected: boolean;
  onClick: () => void;
}) {
  const isSpam = lead.score?.spam === true;
  const status = emailStatusLabel(lead);
  const formTitle =
    typeof lead.meta.form_title === "string"
      ? String(lead.meta.form_title).replace(/ Form$| \(\d+\)$/g, "").slice(0, 20)
      : "Form";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2.5 transition-all ${
        selected
          ? "bg-accent/5 border-l-[3px] border-accent"
          : "border-l-[3px] border-transparent hover:bg-surface-hover/50"
      } ${isSpam ? "opacity-45" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar / Initials */}
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 text-[11px] font-semibold text-accent">
          {getInitials(lead.name || "?")}
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Name + Score */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[13px] font-semibold text-foreground truncate ${
                isSpam ? "line-through" : ""
              }`}
            >
              {lead.name || "Unknown"}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {lead.score && (
                <span
                  className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                    scoreColor(lead.score.score) === "success"
                      ? "bg-success/10 text-success"
                      : scoreColor(lead.score.score) === "warning"
                        ? "bg-warning/10 text-warning"
                        : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {lead.score.score}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Company + Form source */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {lead.company && (
              <span className="text-[10px] text-foreground-tertiary truncate">
                {lead.company}
              </span>
            )}
            {lead.company && (
              <span className="text-[10px] text-foreground-tertiary/50">
                {"\u00B7"}
              </span>
            )}
            <span className="text-[10px] text-foreground-tertiary truncate">
              {formTitle}
            </span>
          </div>

          {/* Row 3: Email status + Time */}
          <div className="flex items-center justify-between mt-1">
            <span
              className={`text-[11px] font-medium ${
                status.type === "success"
                  ? "text-success"
                  : status.type === "error"
                    ? "text-destructive"
                    : "text-warning"
              }`}
            >
              {status.type === "success"
                ? "\u2713 "
                : status.type === "error"
                  ? "\u2715 "
                  : "\u23F3 "}
              {status.text}
            </span>
            <span className="text-[10px] text-foreground-tertiary">
              {timeAgo(lead.date)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Email History Item
// ---------------------------------------------------------------------------

function EmailHistoryItem({ email }: { email: LeadEmail }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = email.email_type === "acknowledgement"
    ? "Acknowledgement"
    : `Follow-up ${email.email_type.replace("followup_", "")}`;

  return (
    <div className="border border-divider rounded-[8px] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-hover/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StatusBadge type="success">{typeLabel}</StatusBadge>
          <span className="text-xs text-foreground font-medium truncate max-w-[200px]">
            {email.subject}
          </span>
        </div>
        <span className="text-[10px] text-foreground-tertiary shrink-0">
          {email.sent_at
            ? new Date(email.sent_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-divider">
          <div
            className="text-xs text-foreground leading-relaxed prose prose-xs max-w-none dark:prose-invert [&_a]:text-accent mt-2"
            dangerouslySetInnerHTML={{ __html: email.body_html }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right Panel: Lead Detail
// ---------------------------------------------------------------------------

function LeadDetail({
  lead,
  onAiDraft,
  onMarkSpam,
  onMarkReplied,
  onStopFollowups,
  actionLoading,
  composeRequest,
  onComposeHandled,
}: {
  lead: MergedLead;
  onAiDraft: (lead: MergedLead) => void;
  onMarkSpam: (leadId: string) => void;
  onMarkReplied: (leadId: string) => void;
  onStopFollowups: (leadId: string) => void;
  actionLoading: string | null;
  composeRequest: ComposeRequest | null;
  onComposeHandled: () => void;
}) {
  const sentEmails = lead.emails.filter((e) => e.status === "sent");

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header: Name, company, form, time, score */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-foreground truncate">
              {lead.name || "Unknown Lead"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {lead.company && (
                <span className="text-[12px] text-foreground-secondary">
                  {lead.company}
                </span>
              )}
              {lead.company && (
                <span className="text-foreground-tertiary/40">{"\u00B7"}</span>
              )}
              <span className="text-[12px] text-foreground-tertiary">
                {typeof lead.meta.form_title === "string"
                  ? String(lead.meta.form_title).replace(/ Form$| \(\d+\)$/g, "")
                  : "Form submission"}
              </span>
              <span className="text-foreground-tertiary/40">{"\u00B7"}</span>
              <span className="text-[12px] text-foreground-tertiary">
                {timeAgo(lead.date)}
              </span>
            </div>
          </div>

          {lead.score && (
            <div className="shrink-0">
              <StatusBadge type={scoreColor(lead.score.score)}>
                Score: {lead.score.score}
              </StatusBadge>
            </div>
          )}
        </div>

        {lead.score?.reasoning && (
          <p className="text-[11px] text-foreground-tertiary mt-2 leading-relaxed">
            {lead.score.reasoning}
          </p>
        )}
      </div>

      {/* Contact bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/15 transition-colors"
          >
            <Mail className="w-3 h-3" strokeWidth={2} />
            {lead.email}
          </a>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success text-xs font-medium hover:bg-success/15 transition-colors"
          >
            <Phone className="w-3 h-3" strokeWidth={2} />
            {lead.phone}
          </a>
        )}
        {typeof lead.meta.source_url === "string" && lead.meta.source_url && (
          <a
            href={lead.meta.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-foreground-tertiary/10 text-foreground-secondary text-xs font-medium hover:bg-foreground-tertiary/15 transition-colors"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={2} />
            Source
          </a>
        )}
      </div>

      {/* Lead Action Toolbar — primary actions for this lead, always visible */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {!lead.score?.spam && lead.email && (
          <button
            onClick={() => onAiDraft(lead)}
            disabled={actionLoading === "draft"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-[11px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {actionLoading === "draft" ? (
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
            ) : (
              <Sparkles className="w-3 h-3" strokeWidth={2} />
            )}
            AI Draft
          </button>
        )}
        {sentEmails.length > 0 && lead.score?.status === "contacted" && (
          <button
            onClick={() => onMarkReplied(lead.id)}
            disabled={actionLoading === "replied"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success text-[11px] font-semibold hover:bg-success/15 transition-colors disabled:opacity-50"
          >
            {actionLoading === "replied" ? (
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
            ) : (
              <CheckCircle className="w-3 h-3" strokeWidth={2} />
            )}
            Mark Replied
          </button>
        )}
        <div className="flex-1" />
        {!lead.score?.spam && (
          <button
            onClick={() => onMarkSpam(lead.id)}
            disabled={actionLoading === "spam"}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-foreground-tertiary text-[11px] font-medium hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
            aria-label="Mark as spam"
            title="Mark as spam"
          >
            {actionLoading === "spam" ? (
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
            ) : (
              <Ban className="w-3 h-3" strokeWidth={2} />
            )}
            Spam
          </button>
        )}
      </div>

      {/* Message */}
      {lead.message && (
        <div>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            Message
          </span>
          <div className="bg-background rounded-[8px] p-3 mt-1.5 dark:bg-foreground-tertiary/5">
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">
              {lead.message}
            </p>
          </div>
        </div>
      )}

      {/* Services */}
      {lead.services.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            Services
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {lead.services.map((s, i) => (
              <span
                key={i}
                className="inline-block px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11px] font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conversations Section — unified multi-thread email surface.
          AI Draft button on the toolbar above pre-fills this section's
          composer via composeRequest. Replaces the old DraftEditor /
          Send-from-lead_emails flow. */}
      <div className="h-px bg-divider" />
      <ConversationsSection
        leadId={lead.id}
        leadEmail={lead.email}
        composeRequest={composeRequest}
        onComposeHandled={onComposeHandled}
      />

      {/* Task 16: ContextEmailPanel — new context-engine surface that
          shows emails linked via the email_contexts table. Lives alongside
          the legacy ConversationsSection until Task 19 migrates it away. */}
      {lead?.id ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Linked emails (context engine)
          </h3>
          <div className="h-[480px]">
            <ContextEmailPanel
              contextType="lead"
              contextId={lead.id}
              defaultRecipient={lead.email ?? undefined}
            />
          </div>
        </section>
      ) : null}

      {/* Legacy Email History — read-only archive of pre-Path-A sent emails.
          New sends go through Conversations. Decommission once `lead_emails`
          stops getting written to (already true after Path A). */}
      {sentEmails.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            Archived Sent Emails ({sentEmails.length})
          </span>
          <div className="mt-1.5 space-y-2">
            {sentEmails.map((email) => (
              <EmailHistoryItem key={email.id} email={email} />
            ))}
          </div>
        </div>
      )}

      {/* Unreplied alert — passive warning; "Mark Replied" lives on the action toolbar */}
      {sentEmails.length > 0 && lead.score?.status === "contacted" && (
        <div className="flex items-center gap-2 bg-warning/5 border border-warning/20 rounded-[8px] p-3">
          <AlertCircle className="w-4 h-4 text-warning shrink-0" strokeWidth={2} />
          <span className="text-xs text-warning font-medium">
            No reply yet — {sentEmails.length} email{sentEmails.length > 1 ? "s" : ""} sent
          </span>
        </div>
      )}

      {/* Replied badge */}
      {lead.score?.status === "qualified" && (
        <div className="flex items-center gap-2 bg-success/5 border border-success/20 rounded-[8px] p-3">
          <CheckCircle className="w-4 h-4 text-success" strokeWidth={2} />
          <span className="text-xs text-success font-medium">Lead replied — follow-ups stopped</span>
        </div>
      )}

      {/* Follow-up Timeline */}
      {lead.followups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" strokeWidth={2} />
              Follow-up Timeline
            </span>
            {lead.followups.some((f) => f.status === "pending") && (
              <button
                onClick={() => onStopFollowups(lead.id)}
                disabled={actionLoading === "stop"}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {actionLoading === "stop" ? (
                  <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
                ) : (
                  <XCircle className="w-3 h-3" strokeWidth={2} />
                )}
                Stop Follow-ups
              </button>
            )}
          </div>

          <div className="space-y-0 relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-divider" />

            {lead.followups
              .sort((a, b) => a.step - b.step)
              .map((followup) => (
                <div
                  key={followup.id}
                  className="flex items-center gap-3 py-1.5 relative"
                >
                  {/* Dot */}
                  <div
                    className={`w-[6px] h-[6px] rounded-full shrink-0 ml-[8px] z-10 ${
                      followup.status === "sent"
                        ? "bg-success"
                        : followup.status === "pending"
                          ? "bg-warning"
                          : "bg-foreground-tertiary/30"
                    }`}
                  />

                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[12px] text-foreground">
                      Follow-up {followup.step}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-foreground-tertiary">
                        {new Date(followup.scheduled_for).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                          }
                        )}
                      </span>
                      <StatusBadge
                        type={
                          followup.status === "sent"
                            ? "success"
                            : followup.status === "pending"
                              ? "warning"
                              : followup.status === "cancelled"
                                ? "error"
                                : "neutral"
                        }
                      >
                        {followup.status}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LeadsPage() {
  // Core state
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [scores, setScores] = useState<LeadScore[]>([]);
  const [emails, setEmails] = useState<LeadEmail[]>([]);
  const [followups, setFollowups] = useState<LeadFollowup[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScoreFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qualifyLoading, setQualifyLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  // When set, the LeadDetail panel forwards this to ConversationsSection,
  // which opens its New Email form pre-filled (used by the AI Draft button).
  const [composeRequest, setComposeRequest] = useState<ComposeRequest | null>(null);

  const supabase = useMemo(() => createClient(), []);

  function showToast(message: string, type: "success" | "error" | "info" = "info") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/xapi/leads/website?source=all");
      const json = (await res.json()) as {
        data?: { leads: LeadData[]; total: number };
        error?: string;
      };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `Failed to fetch leads (${res.status})`);
      }
      if (json.data) {
        setLeads(json.data.leads);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load leads";
      setError(message);
    }
  }, []);

  const fetchScores = useCallback(async () => {
    const { data } = await supabase
      .from("lead_scores")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setScores(data as LeadScore[]);
  }, [supabase]);

  const fetchEmails = useCallback(async () => {
    const { data } = await supabase
      .from("lead_emails")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEmails(data as LeadEmail[]);
  }, [supabase]);

  const fetchFollowups = useCallback(async () => {
    const { data } = await supabase
      .from("lead_followups")
      .select("*")
      .order("step", { ascending: true });
    if (data) setFollowups(data as LeadFollowup[]);
  }, [supabase]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchLeads(), fetchScores(), fetchEmails(), fetchFollowups()]);
    setLoading(false);
    setLastRefresh(new Date());
  }, [fetchLeads, fetchScores, fetchEmails, fetchFollowups]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      loadAll();
      setLastRefresh(new Date());
    }, 60000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [loadAll]);

  // -------------------------------------------------------------------------
  // Merged leads
  // -------------------------------------------------------------------------

  const mergedLeads: MergedLead[] = useMemo(() => {
    const scoreMap = new Map<string, LeadScore>();
    for (const s of scores) scoreMap.set(s.lead_id, s);

    const emailMap = new Map<string, LeadEmail[]>();
    for (const e of emails) {
      const existing = emailMap.get(e.lead_id) ?? [];
      existing.push(e);
      emailMap.set(e.lead_id, existing);
    }

    const followupMap = new Map<string, LeadFollowup[]>();
    for (const f of followups) {
      const existing = followupMap.get(f.lead_id) ?? [];
      existing.push(f);
      followupMap.set(f.lead_id, existing);
    }

    return leads.map((lead) => ({
      ...lead,
      score: scoreMap.get(lead.id),
      emails: emailMap.get(lead.id) ?? [],
      followups: followupMap.get(lead.id) ?? [],
    }));
  }, [leads, scores, emails, followups]);

  // -------------------------------------------------------------------------
  // Filter & search
  // -------------------------------------------------------------------------

  const filteredLeads = useMemo(() => {
    let result = mergedLeads;

    // Filter by score category
    switch (filter) {
      case "qualified":
        result = result.filter(
          (l) => l.score && l.score.score >= LEAD_THRESHOLDS.autoSend
        );
        break;
      case "review":
        result = result.filter(
          (l) =>
            l.score &&
            l.score.score >= LEAD_THRESHOLDS.review &&
            l.score.score < LEAD_THRESHOLDS.autoSend
        );
        break;
      case "spam":
        result = result.filter(
          (l) => l.score && l.score.score < LEAD_THRESHOLDS.spam
        );
        break;
      default:
        // "all" - hide spam unless spam filter is active
        result = result.filter((l) => !l.score?.spam);
        break;
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.company && l.company.toLowerCase().includes(q)) ||
          (l.message && l.message.toLowerCase().includes(q))
      );
    }

    return result;
  }, [mergedLeads, filter, searchQuery]);

  // -------------------------------------------------------------------------
  // Counts for filter pills
  // -------------------------------------------------------------------------

  const counts = useMemo(() => {
    const all = mergedLeads.filter((l) => !l.score?.spam).length;
    const qualified = mergedLeads.filter(
      (l) => l.score && l.score.score >= LEAD_THRESHOLDS.autoSend
    ).length;
    const review = mergedLeads.filter(
      (l) =>
        l.score &&
        l.score.score >= LEAD_THRESHOLDS.review &&
        l.score.score < LEAD_THRESHOLDS.autoSend
    ).length;
    const spam = mergedLeads.filter(
      (l) => l.score && l.score.score < LEAD_THRESHOLDS.spam
    ).length;
    return { all, qualified, review, spam };
  }, [mergedLeads]);

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  const metrics = useMemo(() => {
    const total = leads.length;
    const qualified = scores.filter(
      (s) => s.score >= LEAD_THRESHOLDS.autoSend
    ).length;
    const review = scores.filter(
      (s) =>
        s.score >= LEAD_THRESHOLDS.review &&
        s.score < LEAD_THRESHOLDS.autoSend
    ).length;
    const emailsSent = emails.filter((e) => e.status === "sent").length;
    const spamBlocked = scores.filter(
      (s) => s.score < LEAD_THRESHOLDS.spam
    ).length;
    return { total, qualified, review, emailsSent, spamBlocked };
  }, [leads, scores, emails]);

  // -------------------------------------------------------------------------
  // Selected lead
  // -------------------------------------------------------------------------

  const selectedLead = useMemo(
    () => mergedLeads.find((l) => l.id === selectedLeadId) ?? null,
    [mergedLeads, selectedLeadId]
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleQualifyAll = async () => {
    const unscored = mergedLeads.filter((l) => !l.score);
    if (unscored.length === 0) return;

    setQualifyLoading(true);
    try {
      const payload = unscored.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        message: l.message,
        services: l.services,
        meta: l.meta,
      }));

      const res = await fetch("/xapi/leads/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: payload }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Qualification failed");
      }

      // Refresh scores
      await fetchScores();
      showToast("Lead scoring complete!", "success");
    } catch (err) {
      console.error("Qualify error:", err);
      showToast("Failed to qualify leads", "error");
    } finally {
      setQualifyLoading(false);
    }
  };

  // Path A: AI Draft now generates text only and drops it into the
  // Conversations composer. No write to lead_emails — the unified
  // email_threads/email_messages pipeline owns the send.
  const handleAiDraft = async (lead: MergedLead) => {
    if (!lead.email) return;
    setActionLoading("draft");
    try {
      const emailType: EmailType = "acknowledgement";
      const res = await fetch(`/xapi/leads/${lead.id}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_data: {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            message: lead.message,
            services: lead.services,
            meta: lead.meta,
          },
          email_type: emailType,
        }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Draft failed");
      }

      const json = (await res.json()) as {
        data: { subject: string; body: string; default_cc: string[] };
      };
      setComposeRequest({
        subject: json.data.subject,
        body: json.data.body,
        ccFounders: json.data.default_cc,
      });
      showToast("AI draft ready — review and send", "success");
    } catch (err) {
      console.error("Draft error:", err);
      showToast("Failed to generate draft", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkSpam = async (leadId: string) => {
    setActionLoading("spam");
    try {
      const res = await fetch(`/xapi/leads/${leadId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_spam" }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Action failed");
      }

      await Promise.all([fetchScores(), fetchEmails(), fetchFollowups()]);
      showToast("Lead marked as spam", "info");
    } catch (err) {
      console.error("Mark spam error:", err);
      showToast("Failed to mark as spam", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopFollowups = async (leadId: string) => {
    setActionLoading("stop");
    try {
      const res = await fetch(`/xapi/leads/${leadId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop_followups" }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Action failed");
      }

      await fetchFollowups();
    } catch (err) {
      console.error("Stop followups error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReplied = async (leadId: string) => {
    setActionLoading("replied");
    try {
      const res = await fetch(`/xapi/leads/${leadId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_replied" }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Action failed");
      }
      await Promise.all([fetchScores(), fetchFollowups()]);
      showToast("Lead marked as replied — follow-ups stopped", "success");
    } catch (err) {
      console.error("Mark replied error:", err);
      showToast("Failed to mark as replied", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const unscoredCount = mergedLeads.filter((l) => !l.score).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <PageHeader
        title="Website Leads"
        description="AI-scored leads with automated email outreach"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-foreground-tertiary flex items-center gap-1" title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
            <button
              onClick={() => loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background-secondary dark:border dark:border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-all"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
              Refresh
            </button>
            {unscoredCount > 0 && (
              <button
                onClick={handleQualifyAll}
                disabled={qualifyLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-all disabled:opacity-50"
              >
                {qualifyLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                Qualify All ({unscoredCount})
              </button>
            )}
          </div>
        }
      />

      {/* Error */}
      {error && !leads.length && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-[10px] p-4 mb-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="w-4 h-4 text-destructive mt-0.5 shrink-0"
              strokeWidth={2}
            />
            <div>
              <p className="text-[13px] text-destructive font-medium">
                Could not load leads
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">{error}</p>
              <button
                onClick={() => loadAll()}
                className="text-xs font-medium text-accent mt-2 hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {loading && !leads.length ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Leads"
              value={`${metrics.total}`}
              icon={Globe}
              description="from all forms"
            />
            <MetricCard
              title="Qualified"
              value={`${metrics.qualified}`}
              icon={CheckCircle}
              description="score 85+"
            />
            <MetricCard
              title="Needs Review"
              value={`${metrics.review}`}
              icon={AlertCircle}
              description="score 50-84"
            />
            <MetricCard
              title="Emails Sent"
              value={`${metrics.emailsSent}`}
              icon={Mail}
              description="delivered"
            />
            <MetricCard
              title="Spam Blocked"
              value={`${metrics.spamBlocked}`}
              icon={ShieldX}
              description="score <50"
            />
          </>
        )}
      </div>

      {/* Split Panel */}
      <div className="flex gap-0 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Left Panel */}
        <div className="w-[340px] shrink-0 bg-background-secondary rounded-l-[10px] dark:border dark:border-border dark:border-r-0 flex flex-col overflow-hidden">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 px-3 pt-3 pb-2 flex-wrap">
            <FilterPill
              label="All"
              count={counts.all}
              active={filter === "all"}
              color="bg-accent/10 text-accent"
              onClick={() => setFilter("all")}
            />
            <FilterPill
              label="Qualified"
              count={counts.qualified}
              active={filter === "qualified"}
              color="bg-success/10 text-success"
              onClick={() => setFilter("qualified")}
            />
            <FilterPill
              label="Review"
              count={counts.review}
              active={filter === "review"}
              color="bg-warning/10 text-warning"
              onClick={() => setFilter("review")}
            />
            <FilterPill
              label="Spam"
              count={counts.spam}
              active={filter === "spam"}
              color="bg-destructive/10 text-destructive"
              onClick={() => setFilter("spam")}
            />
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-tertiary"
                strokeWidth={2}
              />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-background dark:bg-foreground-tertiary/5 border border-divider text-[13px] text-foreground placeholder:text-foreground-tertiary/60 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-divider mx-3" />

          {/* Lead List */}
          <div className="flex-1 overflow-y-auto">
            {loading && !leads.length ? (
              <LeadListSkeleton />
            ) : filteredLeads.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <Inbox
                  className="w-6 h-6 text-foreground-tertiary mx-auto mb-2"
                  strokeWidth={1.5}
                />
                <p className="text-[13px] font-medium text-foreground-secondary">
                  No leads found
                </p>
                <p className="text-xs text-foreground-tertiary mt-0.5">
                  {searchQuery
                    ? "Try a different search term"
                    : filter !== "all"
                      ? `No ${filter} leads. Try switching to "All".`
                      : "Form submissions will appear here."}
                </p>
              </div>
            ) : (
              <div>
                {filteredLeads.map((lead, i) => (
                  <div key={lead.id}>
                    <LeadListItem
                      lead={lead}
                      selected={lead.id === selectedLeadId}
                      onClick={() => setSelectedLeadId(lead.id)}
                    />
                    {i < filteredLeads.length - 1 && (
                      <div className="h-px bg-divider mx-3.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Count footer */}
          <div className="px-3.5 py-2 border-t border-divider">
            <span className="text-[11px] text-foreground-tertiary">
              {filteredLeads.length} lead
              {filteredLeads.length !== 1 ? "s" : ""}
              {searchQuery ? ` matching "${searchQuery}"` : ""}
            </span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 bg-background-secondary rounded-r-[10px] dark:border dark:border-border dark:border-l-0 overflow-hidden border-l border-divider">
          {selectedLead ? (
            <LeadDetail
              lead={selectedLead}
              onAiDraft={handleAiDraft}
              onMarkSpam={handleMarkSpam}
              onMarkReplied={handleMarkReplied}
              onStopFollowups={handleStopFollowups}
              actionLoading={actionLoading}
              composeRequest={composeRequest}
              onComposeHandled={() => setComposeRequest(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Inbox
                  className="w-8 h-8 text-foreground-tertiary/40 mx-auto mb-3"
                  strokeWidth={1.5}
                />
                <p className="text-[14px] font-medium text-foreground-secondary">
                  Select a lead to view details
                </p>
                <p className="text-xs text-foreground-tertiary mt-1">
                  Click on any lead in the left panel to see their full profile,
                  AI email drafts, and follow-up timeline.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in slide-in-from-bottom-2 fade-in duration-300 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-success text-white"
                : toast.type === "error"
                  ? "bg-destructive text-white"
                  : "bg-foreground text-background"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
