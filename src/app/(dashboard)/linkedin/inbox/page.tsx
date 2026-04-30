"use client";

// ---------------------------------------------------------------------------
// Prospect Inbox — Human-in-the-loop CRM for LinkedIn outreach.
//
// Compliance note: this page does NOT automate LinkedIn. It is a system of
// record. The operator performs actions manually on linkedin.com; this page
// suggests the next action, drafts a message, and logs what was done.
// No Puppeteer, no third-party LinkedIn automators, no scraping at display
// time. See LinkedIn User Agreement §8.2 and Professional Community Policies.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SafetyPipeline,
  type PipelineDecision,
} from "@/components/linkedin/SafetyPipeline";

// ─── Types ─────────────────────────────────────────────────────────────────
type ProspectStatus =
  | "pending"
  | "in_sequence"
  | "replied"
  | "meeting"
  | "opted_out";

type Outcome =
  | "done"
  | "replied"
  | "accepted"
  | "rejected"
  | "skipped"
  | "bounced";

interface Prospect {
  id: string;
  name: string;
  first_name: string;
  headline: string;
  company: string;
  industry: string;
  location: string;
  email: string | null;
  profile_url: string | null;
  score: number;
  step: number;
  status: ProspectStatus;
  reply_received: boolean;
  last_action: string | null;
  last_message: string | null;
  suggested_action: string | null;
  suggested_message: string | null;
  operator_notes: string;
  opened_at: string | null;
  completed_at: string | null;
  created_at: string;
  campaign_id: string;
  linkedin_campaigns?: {
    id: string;
    name: string;
    status: string;
    account_id: string | null;
  } | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface AccountHealth {
  id: string;
  slug: string;
  name: string;
  type: "personal" | "company";
  warmup_tier: string;
  hard_caps: Record<string, number>;
  weekly_limits: Record<string, number>;
  cooldown_until: string | null;
  cooldown_reason: string | null;
  stop_flag: boolean;
  stop_flag_reason: string | null;
  today_usage: Record<string, number>;
  week_usage: Record<string, number>;
  rejects_24h: number;
  wins_24h: number;
  total_24h: number;
  health_score: number;
  risk_level: "healthy" | "at_risk" | "cooldown" | "stopped";
}

interface ProspectAction {
  id: string;
  action_key: string;
  message_sent: string | null;
  outcome: Outcome;
  step: number;
  performed_by: string;
  created_at: string;
}

// ─── Small presentational helpers ──────────────────────────────────────────
const STATUS_STYLES: Record<ProspectStatus, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  in_sequence: "bg-blue-100 text-blue-700 ring-blue-200",
  replied: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  meeting: "bg-violet-100 text-violet-700 ring-violet-200",
  opted_out: "bg-rose-100 text-rose-700 ring-rose-200",
};

function StatusBadge({ status }: { status: ProspectStatus }) {
  const label = status.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-500"
      : score >= 70
        ? "bg-blue-500"
        : score >= 55
          ? "bg-amber-500"
          : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium tabular-nums">
        {score}
      </span>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function ProspectInboxPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accountsHealth, setAccountsHealth] = useState<AccountHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [campaignId, setCampaignId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [industry, setIndustry] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("score");

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => prospects.find((p) => p.id === selectedId) ?? null,
    [prospects, selectedId],
  );

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (campaignId !== "all") params.set("campaign_id", campaignId);
    if (status !== "all") params.set("status", status);
    if (minScore && Number(minScore) > 0) params.set("min_score", minScore);
    if (industry.trim()) params.set("industry", industry.trim());
    if (search.trim()) params.set("q", search.trim());
    params.set("sort", sort);

    try {
      const res = await fetch(`/xapi/linkedin/prospects?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setProspects(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [campaignId, status, minScore, industry, search, sort]);

  useEffect(() => {
    void fetchProspects();
  }, [fetchProspects]);

  // Load campaigns for the filter dropdown
  useEffect(() => {
    fetch("/xapi/linkedin/campaigns", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data)) setCampaigns(j.data);
      })
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  // Load account health (used by the top-of-page safety card + killswitch).
  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/xapi/linkedin/accounts/all/health", {
        cache: "no-store",
      });
      const j = await res.json();
      if (Array.isArray(j?.data)) setAccountsHealth(j.data);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    const t = setInterval(loadHealth, 30_000);
    return () => clearInterval(t);
  }, [loadHealth]);

  // Counters
  const counts = useMemo(() => {
    const total = prospects.length;
    const replied = prospects.filter(
      (p) => p.status === "replied" || p.reply_received,
    ).length;
    const inSeq = prospects.filter((p) => p.status === "in_sequence").length;
    const pending = prospects.filter((p) => p.status === "pending").length;
    return { total, replied, inSeq, pending };
  }, [prospects]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Prospect Inbox"
        description="Your LinkedIn worklist. We suggest — you execute on LinkedIn.com — we log what you did."
      />

      {/* Compliance banner — always visible, non-dismissable by design */}
      <ComplianceBanner />

      {/* Account health — today/week vs caps, risk level, killswitch */}
      <AccountsHealthSection
        accounts={accountsHealth}
        onRefresh={loadHealth}
      />

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CounterCard label="Total" value={counts.total} tone="slate" />
        <CounterCard label="Pending" value={counts.pending} tone="amber" />
        <CounterCard label="In sequence" value={counts.inSeq} tone="blue" />
        <CounterCard label="Replied" value={counts.replied} tone="emerald" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Search
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, headline, company, email"
          />
        </div>

        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Campaign
          </label>
          <Select value={campaignId} onValueChange={(v) => setCampaignId(v ?? "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Status
          </label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_sequence">In sequence</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="opted_out">Opted out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Min score
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
        </div>

        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Industry
          </label>
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. SaaS"
          />
        </div>

        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Sort by
          </label>
          <Select value={sort} onValueChange={(v) => setSort(v ?? "score")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="last_action">Last action</SelectItem>
              <SelectItem value="created_at">Recently added</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="step">Step</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        {error ? (
          <div className="p-6 text-sm text-rose-600">Error: {error}</div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No prospects match the current filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Last action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelectedId(p.id)}
                >
                  <TableCell>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="line-clamp-1 text-xs text-slate-500">
                      {p.headline || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.company || "—"}
                    {p.location ? (
                      <div className="text-xs text-slate-500">
                        {p.location}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{p.industry || "—"}</TableCell>
                  <TableCell>
                    <ScoreBar score={p.score} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {p.step}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    {p.suggested_action ? (
                      <Badge variant="outline" className="capitalize">
                        {p.suggested_action}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {timeAgo(p.last_action)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Drawer */}
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          {selected ? (
            <ProspectDrawer
              prospect={selected}
              onClose={() => setSelectedId(null)}
              onChanged={fetchProspects}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── ComplianceBanner ──────────────────────────────────────────────────────
function ComplianceBanner() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <div>
        <div className="font-semibold">Human-in-the-loop mode</div>
        <p className="mt-0.5">
          This dashboard never touches linkedin.com on your behalf. You perform
          every action manually; we suggest, enforce daily caps, and log what
          you did. Hard caps, auto-cooldowns, and a killswitch protect the
          account from velocity-based detection.
        </p>
      </div>
    </div>
  );
}

// ─── AccountsHealthSection ─────────────────────────────────────────────────
function AccountsHealthSection({
  accounts,
  onRefresh,
}: {
  accounts: AccountHealth[];
  onRefresh: () => void;
}) {
  if (accounts.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {accounts.map((a) => (
        <AccountHealthCard key={a.id} account={a} onChanged={onRefresh} />
      ))}
    </div>
  );
}

function AccountHealthCard({
  account,
  onChanged,
}: {
  account: AccountHealth;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggleStop = async () => {
    setBusy(true);
    try {
      await fetch(`/xapi/linkedin/accounts/${account.id}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stop_flag: !account.stop_flag,
          stop_flag_reason: account.stop_flag
            ? undefined
            : "Operator paused from inbox",
        }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const clearCooldown = async () => {
    setBusy(true);
    try {
      await fetch(`/xapi/linkedin/accounts/${account.id}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear_cooldown: true }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const tone = {
    healthy: "border-emerald-200 bg-white",
    at_risk: "border-amber-300 bg-amber-50",
    cooldown: "border-blue-300 bg-blue-50",
    stopped: "border-rose-300 bg-rose-50",
  }[account.risk_level];

  const scoreColor =
    account.health_score >= 90
      ? "text-emerald-600"
      : account.health_score >= 70
        ? "text-amber-600"
        : "text-rose-600";

  const topCapKeys = Object.keys(account.hard_caps).slice(0, 5);

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {account.name}
          </div>
          <div className="text-xs text-slate-500">
            {account.type} · {account.warmup_tier}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold tabular-nums ${scoreColor}`}>
            {account.health_score}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            health
          </div>
        </div>
      </div>

      {/* Risk banner */}
      {account.risk_level === "stopped" ? (
        <div className="mt-2 rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
          Paused — {account.stop_flag_reason ?? "operator stop"}
        </div>
      ) : account.risk_level === "cooldown" ? (
        <div className="mt-2 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
          Cooldown until{" "}
          {account.cooldown_until
            ? new Date(account.cooldown_until).toLocaleString()
            : "—"}
          {account.cooldown_reason ? ` · ${account.cooldown_reason}` : ""}
        </div>
      ) : account.risk_level === "at_risk" ? (
        <div className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          At risk — {account.rejects_24h} rejects in the last 24h. Consider
          pausing.
        </div>
      ) : null}

      {/* Cap bars */}
      <div className="mt-3 space-y-1.5">
        {topCapKeys.map((key) => {
          const cap = account.hard_caps[key] ?? 0;
          const used = account.today_usage?.[key] ?? 0;
          const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
          const barColor =
            pct >= 100
              ? "bg-rose-500"
              : pct >= 80
                ? "bg-amber-500"
                : "bg-emerald-500";
          return (
            <div key={key} className="text-xs">
              <div className="flex justify-between">
                <span className="capitalize text-slate-700">
                  {key.replace("_", " ")}
                </span>
                <span className="tabular-nums text-slate-500">
                  {used}/{cap}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={account.stop_flag ? "default" : "destructive"}
          disabled={busy}
          onClick={toggleStop}
        >
          {account.stop_flag ? "Resume outreach" : "Pause all outreach"}
        </Button>
        {account.cooldown_until &&
        new Date(account.cooldown_until).getTime() > Date.now() ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={clearCooldown}
          >
            Clear cooldown
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ─── CounterCard ───────────────────────────────────────────────────────────
function CounterCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "blue" | "emerald";
}) {
  const bg = {
    slate: "bg-slate-50 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────
function ProspectDrawer({
  prospect,
  onClose,
  onChanged,
}: {
  prospect: Prospect;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [actionKey, setActionKey] = useState<string>(
    prospect.suggested_action ?? "message",
  );
  const [messageSent, setMessageSent] = useState<string>(
    prospect.suggested_message ?? "",
  );
  const [outcome, setOutcome] = useState<Outcome>("done");
  const [advanceStep, setAdvanceStep] = useState(true);
  const [notes, setNotes] = useState(prospect.operator_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ProspectAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [pipelineDecision, setPipelineDecision] =
    useState<PipelineDecision>("allow");

  const accountIdForPipeline =
    prospect.linkedin_campaigns?.account_id ?? null;

  // Load history
  useEffect(() => {
    setHistoryLoading(true);
    fetch(`/xapi/linkedin/prospects/${prospect.id}/actions`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => setHistory(j?.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [prospect.id]);

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(
        `/api/linkedin/prospects/${prospect.id}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_key: actionKey,
            message_sent: messageSent.trim() || null,
            outcome,
            advance_step: advanceStep,
            operator_notes: notes,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Log failed");
      onChanged();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Log failed");
    } finally {
      setSaving(false);
    }
  };

  const openOnLinkedIn = () => {
    if (!prospect.profile_url) return;
    window.open(prospect.profile_url, "_blank", "noopener,noreferrer");
    // Stamp opened_at so we know the operator went to do the work
    fetch(`/xapi/linkedin/prospects/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_message: messageSent || undefined }),
    }).catch(() => {});
  };

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>{prospect.name}</SheetTitle>
        <SheetDescription>
          {prospect.headline || "No headline"}
          {prospect.company ? ` · ${prospect.company}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-1 py-4">
        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={prospect.status} />
          <Badge variant="outline">Score {prospect.score}</Badge>
          <Badge variant="outline">Step {prospect.step}</Badge>
          {prospect.linkedin_campaigns?.name ? (
            <Badge variant="outline">
              {prospect.linkedin_campaigns.name}
            </Badge>
          ) : null}
          {prospect.industry ? (
            <Badge variant="outline">{prospect.industry}</Badge>
          ) : null}
        </div>

        {/* Open on LinkedIn */}
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-600">
            Do this on LinkedIn.com (human-in-the-loop)
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={!prospect.profile_url}
              onClick={openOnLinkedIn}
            >
              Open profile on LinkedIn
            </Button>
            <span className="text-xs text-slate-500">
              opens in a new tab — perform the action there, then log it below.
            </span>
          </div>
        </div>

        {/* Safety pipeline preview — refreshes when action_key changes */}
        <SafetyPipeline
          accountId={accountIdForPipeline}
          actionKey={actionKey}
          profileUrl={prospect.profile_url}
          onDecisionChange={setPipelineDecision}
        />

        {/* Log action form */}
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">
            Log manual action
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Action
              </label>
              <Select value={actionKey} onValueChange={(v) => setActionKey(v ?? "message")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visit">Visited profile</SelectItem>
                  <SelectItem value="follow">Followed</SelectItem>
                  <SelectItem value="like">Liked a post</SelectItem>
                  <SelectItem value="endorse">Endorsed a skill</SelectItem>
                  <SelectItem value="connect">Sent connect</SelectItem>
                  <SelectItem value="message">Sent message</SelectItem>
                  <SelectItem value="inmail">Sent InMail</SelectItem>
                  <SelectItem value="followup">Follow-up message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Outcome
              </label>
              <Select
                value={outcome}
                onValueChange={(v) => setOutcome((v ?? "done") as Outcome)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Message you sent (optional)
            </label>
            <Textarea
              value={messageSent}
              onChange={(e) => setMessageSent(e.target.value)}
              rows={4}
              placeholder={
                prospect.suggested_message ??
                "Paste or retype what you sent on LinkedIn.com"
              }
            />
            {prospect.suggested_message &&
            messageSent !== prospect.suggested_message ? (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-blue-600 hover:underline"
                onClick={() =>
                  setMessageSent(prospect.suggested_message ?? "")
                }
              >
                Use suggested draft
              </button>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Operator notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything you want to remember about this prospect"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={advanceStep}
              onChange={(e) => setAdvanceStep(e.target.checked)}
            />
            Advance to next funnel step
          </label>

          {formError ? (
            <div className="text-xs text-rose-600">{formError}</div>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={submit}
              disabled={
                saving ||
                (pipelineDecision === "block" && outcome !== "skipped")
              }
            >
              {saving
                ? "Logging…"
                : pipelineDecision === "block" && outcome !== "skipped"
                  ? "Blocked by safety pipeline"
                  : pipelineDecision === "warn"
                    ? "Log action (with warnings)"
                    : "Log action"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
          {pipelineDecision === "block" && outcome !== "skipped" ? (
            <div className="text-[11px] text-slate-500">
              Use outcome &quot;Skipped&quot; to bypass the pipeline and record
              a prospect as not-for-me without burning a quota.
            </div>
          ) : null}
        </div>

        {/* History */}
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-900">
            Activity history
          </div>
          {historyLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : history.length === 0 ? (
            <div className="text-xs text-slate-500">
              No actions logged yet — this will be the first.
            </div>
          ) : (
            <ol className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-start gap-2 border-l-2 border-slate-200 pl-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium capitalize text-slate-800">
                      {h.action_key} · {h.outcome}
                    </div>
                    {h.message_sent ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {h.message_sent}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {timeAgo(h.created_at)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
