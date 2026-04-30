"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  DollarSign,
  Users,
  Zap,
  Target,
  Send,
  Radar,
  ArrowRight,
  Bell,
  RefreshCw,
  Wifi,
  WifiOff,
  CircleDot,
  Receipt,
  FileText,
  Star,
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardMetrics {
  totalWorkflowRuns: number;
  completedRuns: number;
  runningRuns: number;
  failedRuns: number;
  totalLeads: number;
  qualifiedLeads: number;
  totalEmployees: number;
  activeEmployees: number;
  pendingExpenses: number;
  pendingExpenseValue: number;
  pendingInvoices: number;
  totalInvoiceValue: number;
}

interface RecentRun {
  id: string;
  workflow_code: string;
  status: string;
  progress: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  category: string;
  priority: string;
  source_module: string | null;
  source_url: string | null;
  actions: Array<{ label: string; url?: string }>;
  is_read: boolean;
  created_at: string;
}

interface ApiServiceStatus {
  name: string;
  key: string;
  status: "connected" | "disconnected" | "unknown";
}

interface QuickStats {
  agentsActive: number;
  avgQualityScore: number;
  apiStatus: ApiServiceStatus[];
}

interface DashboardData {
  metrics: DashboardMetrics;
  recentRuns: RecentRun[];
  recentNotifications: Notification[];
  quickStats: QuickStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toLocaleString("en-IN");
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const statusMap: Record<string, { type: "success" | "warning" | "error" | "info" | "neutral"; label: string }> = {
  completed: { type: "success", label: "Completed" },
  running: { type: "info", label: "Running" },
  failed: { type: "error", label: "Failed" },
  pending: { type: "neutral", label: "Pending" },
  cancelled: { type: "warning", label: "Cancelled" },
};

const priorityColors: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-accent",
  medium: "bg-warning",
  low: "bg-foreground-tertiary",
};

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

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
      <SkeletonBlock className="w-7 h-7 rounded-full shrink-0" />
      <div className="flex-1">
        <SkeletonBlock className="h-3.5 w-32 mb-1.5" />
        <SkeletonBlock className="h-3 w-48" />
      </div>
      <SkeletonBlock className="h-3 w-10" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Card
// ---------------------------------------------------------------------------

interface QuickActionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}

function QuickActionCard({ icon: Icon, title, description, href }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 bg-background-secondary rounded-[10px] p-3 dark:border dark:border-border hover:bg-surface-hover transition-all duration-200"
    >
      <div className="w-9 h-9 rounded-[8px] bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/15 transition-colors">
        <Icon className="w-4.5 h-4.5 text-accent" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        <div className="text-xs text-foreground-tertiary truncate">{description}</div>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        Go
        <ArrowRight className="w-3 h-3" strokeWidth={2} />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  const [period, setPeriod] = useState("Today");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/home-data");
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to fetch dashboard data" }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: DashboardData };
      setData(json.data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const m = data?.metrics;

  return (
    <div className="animate-in fade-in duration-300">
      {/* ----------------------------------------------------------------- */}
      {/* Header */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">
            Command Centre
          </h1>
          <p className="text-[13px] text-foreground-tertiary mt-0.5">
            {getFormattedDate()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchDashboard();
            }}
            className="p-1.5 rounded-md text-foreground-tertiary hover:text-foreground hover:bg-surface-hover transition-colors"
            title={`Last refresh: ${lastRefresh.toLocaleTimeString()}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          </button>
          <SegmentedControl
            options={["Today", "This Week", "This Month"]}
            value={period}
            onChange={setPeriod}
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Error state */}
      {/* ----------------------------------------------------------------- */}
      {error && !data && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-[10px] p-4 mb-4">
          <p className="text-[13px] text-destructive font-medium">
            Could not load dashboard data
          </p>
          <p className="text-xs text-destructive/70 mt-0.5">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchDashboard();
            }}
            className="text-xs font-medium text-accent mt-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Row 1: Key Metrics */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-4 gap-3">
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
              title="Workflow Runs"
              value={`${m?.completedRuns ?? 0} / ${m?.totalWorkflowRuns ?? 0}`}
              icon={Activity}
              description={
                (m?.runningRuns ?? 0) > 0
                  ? `${m?.runningRuns} running`
                  : (m?.failedRuns ?? 0) > 0
                    ? `${m?.failedRuns} failed`
                    : "all caught up"
              }
            />
            <MetricCard
              title="Leads in Pipeline"
              value={`${m?.totalLeads ?? 0}`}
              icon={Target}
              description={
                (m?.qualifiedLeads ?? 0) > 0
                  ? `${m?.qualifiedLeads} qualified`
                  : "no leads yet"
              }
            />
            <MetricCard
              title="Team Online"
              value={
                (m?.totalEmployees ?? 0) > 0
                  ? `${m?.activeEmployees ?? 0} / ${m?.totalEmployees ?? 0}`
                  : "--"
              }
              icon={Users}
              description={
                (m?.totalEmployees ?? 0) > 0
                  ? `${Math.round(((m?.activeEmployees ?? 0) / (m?.totalEmployees || 1)) * 100)}% active`
                  : "HR module pending"
              }
            />
            <MetricCard
              title="Revenue"
              value={
                (m?.totalInvoiceValue ?? 0) > 0
                  ? `\u20B9${formatCurrency(m?.totalInvoiceValue ?? 0)}`
                  : "\u20B90"
              }
              icon={DollarSign}
              description={
                (m?.pendingInvoices ?? 0) > 0
                  ? `${m?.pendingInvoices} invoices pending`
                  : "no invoices yet"
              }
            />
          </>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Row 2: Two-column layout */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-4">
          {/* Quick Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-foreground">
                Quick Actions
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionCard
                icon={Zap}
                title="Run Strategy Sprint"
                description="Generate brand intel and strategy briefs"
                href="/signal"
              />
              <QuickActionCard
                icon={Target}
                title="Build ICP + Leads"
                description="Create ideal profiles and discover leads"
                href="/gtm"
              />
              <QuickActionCard
                icon={Send}
                title="Generate Outreach"
                description="Build multi-step campaign sequences"
                href="/nexus-flow"
              />
              <QuickActionCard
                icon={Radar}
                title="Scan AI Visibility"
                description="Check brand presence across AI platforms"
                href="/searchlens"
              />
            </div>
          </div>

          {/* Recent Workflow Runs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-foreground">
                Recent Workflow Runs
              </span>
              <Link
                href="/signal"
                className="text-xs font-medium text-accent hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
              {loading && !data ? (
                <>
                  <ListItemSkeleton />
                  <div className="h-px bg-divider mx-3.5" />
                  <ListItemSkeleton />
                  <div className="h-px bg-divider mx-3.5" />
                  <ListItemSkeleton />
                </>
              ) : (data?.recentRuns ?? []).length === 0 ? (
                <div className="px-3.5 py-6 text-center">
                  <Activity className="w-5 h-5 text-foreground-tertiary mx-auto mb-1.5" strokeWidth={1.5} />
                  <p className="text-[13px] text-foreground-tertiary">
                    No workflow runs yet
                  </p>
                  <Link
                    href="/signal"
                    className="text-xs font-medium text-accent hover:underline mt-1 inline-block"
                  >
                    Run your first workflow
                  </Link>
                </div>
              ) : (
                (data?.recentRuns ?? []).map((run, i, arr) => {
                  const st = statusMap[run.status] ?? statusMap.pending;
                  return (
                    <div key={run.id}>
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-background dark:bg-background/40">
                        <div className="w-7 h-7 rounded-full bg-background-secondary flex items-center justify-center shrink-0 dark:bg-foreground-tertiary/10">
                          <Zap
                            className="w-3.5 h-3.5 text-foreground-tertiary"
                            strokeWidth={2}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground">
                              {run.workflow_code}
                            </span>
                            <StatusBadge type={st.type}>{st.label}</StatusBadge>
                          </div>
                          {run.status === "running" && (
                            <ProgressBar
                              value={run.progress}
                              color="accent"
                              className="mt-1.5 max-w-[200px]"
                            />
                          )}
                        </div>
                        <span className="text-xs text-foreground-tertiary shrink-0">
                          {timeAgo(run.created_at)}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="h-px bg-divider mx-3.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">
          {/* Notifications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-foreground">
                Notifications
              </span>
              <Link
                href="/messages"
                className="text-xs font-medium text-accent hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
              {loading && !data ? (
                <>
                  <ListItemSkeleton />
                  <div className="h-px bg-divider mx-3.5" />
                  <ListItemSkeleton />
                  <div className="h-px bg-divider mx-3.5" />
                  <ListItemSkeleton />
                </>
              ) : (data?.recentNotifications ?? []).length === 0 ? (
                <div className="px-3.5 py-6 text-center">
                  <Bell className="w-5 h-5 text-foreground-tertiary mx-auto mb-1.5" strokeWidth={1.5} />
                  <p className="text-[13px] text-foreground-tertiary">
                    No notifications
                  </p>
                </div>
              ) : (
                (data?.recentNotifications ?? []).map((notif, i, arr) => (
                  <div key={notif.id}>
                    <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-background dark:bg-background/40">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          priorityColors[notif.priority] ?? priorityColors.medium
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-foreground leading-tight">
                          {notif.title}
                        </div>
                        {notif.message && (
                          <div className="text-xs text-foreground-tertiary mt-0.5 line-clamp-2">
                            {notif.message}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-foreground-tertiary">
                            {timeAgo(notif.created_at)}
                          </span>
                          {notif.actions?.length > 0 && notif.actions[0].url && (
                            <Link
                              href={notif.actions[0].url}
                              className="text-[11px] font-medium text-accent hover:underline"
                            >
                              {notif.actions[0].label}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="h-px bg-divider mx-3.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* API Health */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-foreground">
                API Health
              </span>
            </div>
            <div className="bg-background-secondary rounded-[10px] p-3 dark:border dark:border-border">
              {loading && !data ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <SkeletonBlock key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {(data?.quickStats.apiStatus ?? []).map((svc) => (
                    <div
                      key={svc.key}
                      className="flex items-center gap-1.5 py-0.5"
                    >
                      {svc.status === "connected" ? (
                        <Wifi className="w-3 h-3 text-success" strokeWidth={2} />
                      ) : svc.status === "disconnected" ? (
                        <WifiOff className="w-3 h-3 text-destructive" strokeWidth={2} />
                      ) : (
                        <CircleDot className="w-3 h-3 text-foreground-tertiary" strokeWidth={2} />
                      )}
                      <span className="text-xs text-foreground-secondary">
                        {svc.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Row 3: Bottom stats */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {loading && !data ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-foreground-tertiary" strokeWidth={1.8} />
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Pending Expenses
                </div>
              </div>
              <div className="text-xl font-bold text-foreground tracking-tight mt-1">
                {m?.pendingExpenses ?? 0}
                {(m?.pendingExpenseValue ?? 0) > 0 && (
                  <span className="text-[13px] font-normal text-foreground-tertiary ml-1.5">
                    {"\u20B9"}{formatCurrency(m?.pendingExpenseValue ?? 0)}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-foreground-tertiary" strokeWidth={1.8} />
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Pending Invoices
                </div>
              </div>
              <div className="text-xl font-bold text-foreground tracking-tight mt-1">
                {m?.pendingInvoices ?? 0}
                {(m?.totalInvoiceValue ?? 0) > 0 && (
                  <span className="text-[13px] font-normal text-foreground-tertiary ml-1.5">
                    {"\u20B9"}{formatCurrency(m?.totalInvoiceValue ?? 0)} total
                  </span>
                )}
              </div>
            </div>
            <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-foreground-tertiary" strokeWidth={1.8} />
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                  Avg Quality Score
                </div>
              </div>
              <div className="text-xl font-bold text-foreground tracking-tight mt-1">
                {(data?.quickStats.avgQualityScore ?? 0) > 0
                  ? `${data?.quickStats.avgQualityScore}%`
                  : "--"}
                {(data?.quickStats.agentsActive ?? 0) > 0 && (
                  <span className="text-[13px] font-normal text-foreground-tertiary ml-1.5">
                    {data?.quickStats.agentsActive} agents today
                  </span>
                )}
              </div>
              {(data?.quickStats.avgQualityScore ?? 0) > 0 && (
                <ProgressBar
                  value={data?.quickStats.avgQualityScore ?? 0}
                  color={
                    (data?.quickStats.avgQualityScore ?? 0) >= 80
                      ? "success"
                      : (data?.quickStats.avgQualityScore ?? 0) >= 50
                        ? "warning"
                        : "accent"
                  }
                  className="mt-2"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
