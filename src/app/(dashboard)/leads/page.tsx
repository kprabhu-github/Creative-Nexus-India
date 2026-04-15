"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  MessageSquare,
  User,
  MessageCircle,
  RefreshCw,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  Mail,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadSource =
  | "woocommerce_order"
  | "woocommerce_customer"
  | "contact_form"
  | "comment";

type LeadStatus = "new" | "contacted" | "qualified" | "converted";

interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  value: number;
  status: LeadStatus;
  date: string;
  meta: Record<string, unknown>;
}

interface SourceCounts {
  orders: number;
  customers: number;
  forms: number;
  comments: number;
}

interface LeadsData {
  leads: Lead[];
  total: number;
  sources: SourceCounts;
}

interface ApiResponse {
  data?: LeadsData;
  error?: string;
  details?: string[];
  warnings?: string[];
}

type SourceFilter = "All" | "Orders" | "Contacts" | "Comments";

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

function formatCurrency(amount: number): string {
  if (amount === 0) return "\u2014";
  return `\u20B9${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function isThisWeek(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

function sourceIcon(source: LeadSource) {
  switch (source) {
    case "woocommerce_order":
      return <ShoppingCart className="w-4 h-4 text-accent" strokeWidth={1.8} />;
    case "woocommerce_customer":
      return <User className="w-4 h-4 text-foreground-tertiary" strokeWidth={1.8} />;
    case "contact_form":
      return <MessageSquare className="w-4 h-4 text-success" strokeWidth={1.8} />;
    case "comment":
      return <MessageCircle className="w-4 h-4 text-warning" strokeWidth={1.8} />;
  }
}

function sourceBadge(source: LeadSource) {
  switch (source) {
    case "woocommerce_order":
      return <StatusBadge type="info">Order</StatusBadge>;
    case "woocommerce_customer":
      return <StatusBadge type="neutral">Customer</StatusBadge>;
    case "contact_form":
      return <StatusBadge type="success">Contact</StatusBadge>;
    case "comment":
      return <StatusBadge type="warning">Comment</StatusBadge>;
  }
}

function statusBadge(status: LeadStatus) {
  const map: Record<LeadStatus, { type: "success" | "warning" | "error" | "info" | "neutral"; label: string }> = {
    new: { type: "info", label: "New" },
    contacted: { type: "warning", label: "Contacted" },
    qualified: { type: "success", label: "Qualified" },
    converted: { type: "success", label: "Converted" },
  };
  const entry = map[status];
  return <StatusBadge type={entry.type}>{entry.label}</StatusBadge>;
}

function filterBySource(leads: Lead[], filter: SourceFilter): Lead[] {
  switch (filter) {
    case "Orders":
      return leads.filter(
        (l) => l.source === "woocommerce_order" || l.source === "woocommerce_customer",
      );
    case "Contacts":
      return leads.filter((l) => l.source === "contact_form");
    case "Comments":
      return leads.filter((l) => l.source === "comment");
    default:
      return leads;
  }
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

function LeadRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1">
        <SkeletonBlock className="h-3.5 w-36 mb-1.5" />
        <SkeletonBlock className="h-3 w-52" />
      </div>
      <SkeletonBlock className="h-5 w-14" />
      <SkeletonBlock className="h-3 w-12" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead Row component
// ---------------------------------------------------------------------------

function LeadRow({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-hover/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Source icon */}
        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0 dark:bg-foreground-tertiary/10">
          {sourceIcon(lead.source)}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">
              {lead.name || "Unknown"}
            </span>
            {sourceBadge(lead.source)}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-accent hover:underline truncate"
              >
                {lead.email}
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-foreground-tertiary hover:text-foreground flex items-center gap-0.5"
              >
                <Phone className="w-3 h-3" strokeWidth={2} />
                {lead.phone}
              </a>
            )}
          </div>
        </div>

        {/* Value */}
        <span className="text-[13px] font-semibold text-foreground shrink-0 tabular-nums">
          {formatCurrency(lead.value)}
        </span>

        {/* Status */}
        <div className="shrink-0">{statusBadge(lead.status)}</div>

        {/* Date */}
        <span className="text-xs text-foreground-tertiary shrink-0 w-16 text-right">
          {timeAgo(lead.date)}
        </span>

        {/* Expand */}
        <button
          className="p-1 rounded text-foreground-tertiary hover:text-foreground transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3.5 pb-3 pt-0 ml-11">
          <div className="bg-background rounded-[8px] p-3 dark:bg-foreground-tertiary/5 space-y-2">
            {lead.company && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-16 shrink-0">
                  Company
                </span>
                <span className="text-xs text-foreground">{lead.company}</span>
              </div>
            )}
            {lead.message && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-16 shrink-0 mt-0.5">
                  Details
                </span>
                <span className="text-xs text-foreground leading-relaxed">
                  {lead.message}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-16 shrink-0">
                Date
              </span>
              <span className="text-xs text-foreground">
                {new Date(lead.date).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-16 shrink-0">
                Source
              </span>
              <span className="text-xs text-foreground">
                {lead.source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            {lead.email && (
              <div className="flex gap-2 mt-1">
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/15 transition-colors"
                >
                  <Mail className="w-3 h-3" strokeWidth={2} />
                  Email
                </a>
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-success/10 text-success text-xs font-medium hover:bg-success/15 transition-colors"
                  >
                    <Phone className="w-3 h-3" strokeWidth={2} />
                    Call
                  </a>
                )}
                {lead.source === "woocommerce_order" && Boolean(lead.meta.order_id) && (
                  <a
                    href={`https://creativenexus.in/wp-admin/post.php?post=${String(lead.meta.order_id)}&action=edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-foreground-tertiary/10 text-foreground-secondary text-xs font-medium hover:bg-foreground-tertiary/15 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" strokeWidth={2} />
                    WooCommerce
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WebsiteLeadsPage() {
  const [data, setData] = useState<LeadsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [filter, setFilter] = useState<SourceFilter>("All");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads/website?source=all&per_page=20");
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || json.error) {
        throw new Error(
          json.error ?? `Failed to fetch leads (${res.status})`,
        );
      }

      if (json.data) {
        setData(json.data);
        setError(null);
        setWarnings(json.warnings ?? []);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load leads";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = data ? filterBySource(data.leads, filter) : [];
  const totalValue = data
    ? data.leads
        .filter((l) => l.source === "woocommerce_order")
        .reduce((sum, l) => sum + l.value, 0)
    : 0;
  const newThisWeek = data
    ? data.leads.filter((l) => isThisWeek(l.date)).length
    : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <PageHeader
        title="Website Leads"
        description="Leads from creativenexus.in"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLeads()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background-secondary dark:border dark:border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-all"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
              Refresh
            </button>
            <SegmentedControl
              options={["All", "Orders", "Contacts", "Comments"]}
              value={filter}
              onChange={(v) => setFilter(v as SourceFilter)}
            />
          </div>
        }
      />

      {/* Error state */}
      {error && !data && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-[10px] p-4 mb-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="w-4 h-4 text-destructive mt-0.5 shrink-0"
              strokeWidth={2}
            />
            <div>
              <p className="text-[13px] text-destructive font-medium">
                Could not load website leads
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">{error}</p>
              {error.includes("authentication") && (
                <div className="mt-2 text-xs text-foreground-secondary space-y-1">
                  <p className="font-medium">Troubleshooting:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-foreground-tertiary">
                    <li>
                      Verify WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and
                      WOOCOMMERCE_CONSUMER_SECRET in .env.local
                    </li>
                    <li>
                      Ensure the API keys have Read permissions in WooCommerce
                      &gt; Settings &gt; Advanced &gt; REST API
                    </li>
                    <li>
                      Check that your site supports HTTPS for API
                      authentication
                    </li>
                  </ol>
                </div>
              )}
              <button
                onClick={() => {
                  setError(null);
                  fetchLeads();
                }}
                className="text-xs font-medium text-accent mt-2 hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings banner */}
      {warnings.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-[10px] p-3 mb-4">
          <p className="text-xs text-warning font-medium">
            Some sources returned warnings:
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-warning/70 mt-0.5">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {loading && !data ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Leads"
              value={`${data?.total ?? 0}`}
              icon={Globe}
              description="all sources combined"
            />
            <MetricCard
              title="WooCommerce Orders"
              value={`${data?.sources.orders ?? 0}`}
              icon={ShoppingCart}
              description={totalValue > 0 ? formatCurrency(totalValue) : "no orders"}
            />
            <MetricCard
              title="Contact Submissions"
              value={`${(data?.sources.forms ?? 0) + (data?.sources.customers ?? 0)}`}
              icon={MessageSquare}
              description={`${data?.sources.customers ?? 0} customers, ${data?.sources.forms ?? 0} forms`}
            />
            <MetricCard
              title="New This Week"
              value={`${newThisWeek}`}
              icon={User}
              description={newThisWeek > 0 ? "fresh leads" : "none yet"}
            />
          </>
        )}
      </div>

      {/* Leads table */}
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {/* Table header */}
        <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
          <span className="text-[13px] font-semibold text-foreground">
            {filter === "All" ? "All Leads" : `${filter}`}
          </span>
          <span className="text-xs text-foreground-tertiary">
            {filteredLeads.length} result{filteredLeads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Column labels */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 border-b border-divider">
          <div className="w-8 shrink-0" />
          <span className="flex-1 text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            Lead
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-20 text-right">
            Value
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-20">
            Status
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider w-16 text-right">
            Date
          </span>
          <div className="w-6" />
        </div>

        {/* Loading skeletons */}
        {loading && !data && (
          <>
            <LeadRowSkeleton />
            <div className="h-px bg-divider mx-3.5" />
            <LeadRowSkeleton />
            <div className="h-px bg-divider mx-3.5" />
            <LeadRowSkeleton />
            <div className="h-px bg-divider mx-3.5" />
            <LeadRowSkeleton />
            <div className="h-px bg-divider mx-3.5" />
            <LeadRowSkeleton />
          </>
        )}

        {/* Empty state */}
        {!loading && filteredLeads.length === 0 && (
          <div className="px-3.5 py-10 text-center">
            <Inbox
              className="w-6 h-6 text-foreground-tertiary mx-auto mb-2"
              strokeWidth={1.5}
            />
            <p className="text-[13px] font-medium text-foreground-secondary">
              No leads found
            </p>
            <p className="text-xs text-foreground-tertiary mt-0.5">
              {filter !== "All"
                ? `No ${filter.toLowerCase()} leads. Try switching to "All".`
                : "Leads from WooCommerce orders, contact forms, and comments will appear here."}
            </p>
          </div>
        )}

        {/* Lead rows */}
        {!loading &&
          filteredLeads.map((lead, i) => (
            <div key={lead.id}>
              <LeadRow lead={lead} />
              {i < filteredLeads.length - 1 && (
                <div className="h-px bg-divider mx-3.5" />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
