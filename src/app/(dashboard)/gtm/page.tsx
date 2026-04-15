"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Target,
  CalendarCheck,
  TrendingUp,
  Mail,
  Link2,
  Pencil,
  ArrowUpRight,
  Zap,
  Clock,
  Send,
  Eye,
  MessageSquare,
  Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const metrics = [
  { label: "Total Leads", value: "2,847", delta: "+312 this month", icon: Users, color: "text-accent" },
  { label: "Qualified", value: "892", delta: "31.3% of total", icon: Target, color: "text-success" },
  { label: "Meetings Booked", value: "47", delta: "+8 this week", icon: CalendarCheck, color: "text-warning" },
  { label: "Conversion Rate", value: "5.3%", delta: "+0.4% vs last month", icon: TrendingUp, color: "text-accent" },
];

const icpProfile = {
  name: "SaaS Mid-Market India",
  description: "B2B SaaS companies with 50-500 employees, Series A-C funded, based in India. Focus on MarTech, HRTech, and FinTech verticals.",
  scoreRubric: "Active",
  lastUpdated: "3 days ago",
  criteria: [
    { label: "Company Size", value: "50-500 employees" },
    { label: "Revenue", value: "INR 5Cr - 50Cr ARR" },
    { label: "Verticals", value: "MarTech, HRTech, FinTech" },
    { label: "Funding Stage", value: "Series A - C" },
  ],
};

const recentCampaigns = [
  {
    name: "SaaS Decision Makers - Q1 Outbound",
    channel: "Email" as const,
    sent: 1240,
    openRate: 42.6,
    replyRate: 8.3,
    meetings: 18,
    status: "Active" as const,
  },
  {
    name: "FinTech Founders - LinkedIn Connect",
    channel: "LinkedIn" as const,
    sent: 680,
    openRate: 61.2,
    replyRate: 12.1,
    meetings: 11,
    status: "Active" as const,
  },
];

type ICPTier = "A" | "B" | "C" | "D";
type LeadStatus = "New" | "Contacted" | "Qualified" | "Meeting";

interface Lead {
  name: string;
  company: string;
  title: string;
  tier: ICPTier;
  intentScore: number;
  lastAction: string;
  status: LeadStatus;
}

const leads: Lead[] = [
  { name: "Ananya Sharma", company: "Razorpay", title: "VP of Marketing", tier: "A", intentScore: 92, lastAction: "Visited pricing page 2h ago", status: "Qualified" },
  { name: "Vikram Desai", company: "Zoho Corp", title: "Head of Growth", tier: "A", intentScore: 88, lastAction: "Downloaded whitepaper", status: "Meeting" },
  { name: "Priya Nair", company: "Freshworks", title: "Director, Demand Gen", tier: "A", intentScore: 85, lastAction: "Opened email 3x", status: "Contacted" },
  { name: "Rohan Mehta", company: "CleverTap", title: "CMO", tier: "B", intentScore: 74, lastAction: "Clicked LinkedIn ad", status: "Contacted" },
  { name: "Shalini Iyer", company: "Darwinbox", title: "Head of Partnerships", tier: "B", intentScore: 68, lastAction: "Replied to sequence", status: "Qualified" },
  { name: "Karthik Rajan", company: "Chargebee", title: "VP Sales", tier: "B", intentScore: 62, lastAction: "Visited case study", status: "New" },
  { name: "Neha Gupta", company: "Leadsquared", title: "Growth Lead", tier: "C", intentScore: 45, lastAction: "Opened cold email", status: "Contacted" },
  { name: "Arjun Patel", company: "Zetwerk", title: "Marketing Manager", tier: "D", intentScore: 28, lastAction: "No engagement yet", status: "New" },
];

interface Campaign {
  name: string;
  type: "Email Sequence" | "LinkedIn" | "Multi-channel";
  status: "Active" | "Paused" | "Completed";
  sent: number;
  opened: number;
  replied: number;
  dateRange: string;
}

const campaigns: Campaign[] = [
  {
    name: "SaaS Decision Makers - Q1 Outbound",
    type: "Email Sequence",
    status: "Active",
    sent: 1240,
    opened: 528,
    replied: 103,
    dateRange: "Mar 1 - Apr 15, 2026",
  },
  {
    name: "FinTech Founders - LinkedIn Connect",
    type: "LinkedIn",
    status: "Active",
    sent: 680,
    opened: 416,
    replied: 82,
    dateRange: "Mar 10 - Apr 15, 2026",
  },
  {
    name: "HRTech Heads - Multi-touch",
    type: "Multi-channel",
    status: "Paused",
    sent: 450,
    opened: 198,
    replied: 41,
    dateRange: "Feb 15 - Mar 30, 2026",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, delta, icon: Icon, color }: typeof metrics[number]) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-foreground-tertiary">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.5} />
      </div>
      <p className="text-[22px] font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] text-foreground-tertiary mt-0.5">{delta}</p>
    </div>
  );
}

function ICPCard() {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">{icpProfile.name}</h3>
            <p className="text-[11px] text-foreground-tertiary">Score rubric: {icpProfile.scoreRubric}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          <Pencil className="w-3 h-3 mr-1" />
          Edit ICP
        </Button>
      </div>
      <p className="text-[12px] text-foreground-secondary mb-3 leading-relaxed">{icpProfile.description}</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {icpProfile.criteria.map((c) => (
          <div key={c.label} className="bg-background rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-foreground-tertiary">{c.label}</p>
            <p className="text-[12px] font-medium text-foreground">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-foreground-tertiary flex items-center gap-1">
        <Clock className="w-3 h-3" /> Last updated {icpProfile.lastUpdated}
      </p>
    </div>
  );
}

function CampaignPerformanceCard({ campaign }: { campaign: typeof recentCampaigns[number] }) {
  const channelIcon = campaign.channel === "Email" ? Mail : Link2;
  const ChannelIcon = channelIcon;

  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <ChannelIcon className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">{campaign.name}</h3>
            <p className="text-[11px] text-foreground-tertiary">{campaign.channel} Campaign</p>
          </div>
        </div>
        <StatusBadge type="success">{campaign.status}</StatusBadge>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><Send className="w-2.5 h-2.5" /> Sent</p>
          <p className="text-[15px] font-semibold text-foreground">{campaign.sent.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Open Rate</p>
          <p className="text-[15px] font-semibold text-foreground">{campaign.openRate}%</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Reply Rate</p>
          <p className="text-[15px] font-semibold text-foreground">{campaign.replyRate}%</p>
        </div>
        <div>
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><CalendarCheck className="w-2.5 h-2.5" /> Meetings</p>
          <p className="text-[15px] font-semibold text-accent">{campaign.meetings}</p>
        </div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: ICPTier }) {
  const map: Record<ICPTier, { type: "success" | "info" | "warning" | "neutral"; label: string }> = {
    A: { type: "success", label: "A-Tier" },
    B: { type: "info", label: "B-Tier" },
    C: { type: "warning", label: "C-Tier" },
    D: { type: "neutral", label: "D-Tier" },
  };
  const config = map[tier];
  return <StatusBadge type={config.type}>{config.label}</StatusBadge>;
}

function StatusLabel({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, "neutral" | "info" | "success" | "warning"> = {
    New: "neutral",
    Contacted: "info",
    Qualified: "success",
    Meeting: "warning",
  };
  return <StatusBadge type={map[status]}>{status}</StatusBadge>;
}

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover transition-colors group">
      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        <span className="text-[11px] font-semibold text-accent">
          {lead.name.split(" ").map((n) => n[0]).join("")}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground truncate">{lead.name}</p>
          <TierBadge tier={lead.tier} />
        </div>
        <p className="text-[11px] text-foreground-tertiary truncate">{lead.title} at {lead.company}</p>
      </div>
      <div className="w-28 hidden sm:block">
        <p className="text-[10px] text-foreground-tertiary mb-1">Intent Score</p>
        <div className="flex items-center gap-2">
          <ProgressBar
            value={lead.intentScore}
            color={lead.intentScore >= 80 ? "success" : lead.intentScore >= 50 ? "warning" : "accent"}
            className="flex-1"
          />
          <span className="text-[11px] font-medium text-foreground w-6 text-right">{lead.intentScore}</span>
        </div>
      </div>
      <div className="hidden md:block w-40">
        <p className="text-[11px] text-foreground-tertiary truncate">{lead.lastAction}</p>
      </div>
      <div className="shrink-0">
        <StatusLabel status={lead.status} />
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`View ${lead.name} details`}
      >
        <ArrowUpRight className="w-3.5 h-3.5 text-foreground-tertiary" />
      </button>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const typeIcon = campaign.type === "Email Sequence" ? Mail : campaign.type === "LinkedIn" ? Link2 : Layers;
  const TypeIcon = typeIcon;
  const statusMap: Record<Campaign["status"], "success" | "warning" | "neutral"> = {
    Active: "success",
    Paused: "warning",
    Completed: "neutral",
  };

  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <TypeIcon className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">{campaign.name}</h3>
            <p className="text-[11px] text-foreground-tertiary">{campaign.type}</p>
          </div>
        </div>
        <StatusBadge type={statusMap[campaign.status]}>{campaign.status}</StatusBadge>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-background rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><Send className="w-2.5 h-2.5" /> Sent</p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{campaign.sent.toLocaleString()}</p>
        </div>
        <div className="bg-background rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Opened</p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{campaign.opened.toLocaleString()}</p>
          <p className="text-[10px] text-foreground-tertiary">{((campaign.opened / campaign.sent) * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-background rounded-lg px-2.5 py-2">
          <p className="text-[10px] text-foreground-tertiary flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Replied</p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{campaign.replied.toLocaleString()}</p>
          <p className="text-[10px] text-foreground-tertiary">{((campaign.replied / campaign.sent) * 100).toFixed(1)}%</p>
        </div>
      </div>
      <p className="text-[11px] text-foreground-tertiary flex items-center gap-1">
        <Clock className="w-3 h-3" /> {campaign.dateRange}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

function OverviewTab() {
  return (
    <div className="space-y-4">
      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* ICP + Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1">
          <ICPCard />
        </div>
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-foreground">Recent Campaign Performance</h2>
            <button className="text-[12px] text-accent hover:underline flex items-center gap-0.5">
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {recentCampaigns.map((c) => (
            <CampaignPerformanceCard key={c.name} campaign={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

const leadFilterOptions = ["All", "A-Tier", "B-Tier", "Contacted"];

function LeadsTab() {
  const [filter, setFilter] = useState("All");

  const filtered = leads.filter((lead) => {
    if (filter === "All") return true;
    if (filter === "A-Tier") return lead.tier === "A";
    if (filter === "B-Tier") return lead.tier === "B";
    if (filter === "Contacted") return lead.status === "Contacted";
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SegmentedControl options={leadFilterOptions} value={filter} onChange={setFilter} />
        <p className="text-[12px] text-foreground-tertiary">{filtered.length} leads</p>
      </div>
      <div className="bg-background-secondary rounded-[10px] dark:border dark:border-border divide-y divide-divider">
        {filtered.map((lead) => (
          <LeadRow key={lead.name} lead={lead} />
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[13px] text-foreground-tertiary">No leads match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignsTab() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-foreground">All Campaigns</h2>
        <Button size="sm">
          <Zap className="w-3 h-3 mr-1" />
          New Campaign
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {campaigns.map((c) => (
          <CampaignCard key={c.name} campaign={c} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const tabs = ["Overview", "Leads", "Campaigns"];

export default function GtmPage() {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Pipeline"
        description="Build ICPs, generate leads, run outbound campaigns."
        actions={<SegmentedControl options={tabs} value={activeTab} onChange={setActiveTab} />}
      />

      {activeTab === "Overview" && <OverviewTab />}
      {activeTab === "Leads" && <LeadsTab />}
      {activeTab === "Campaigns" && <CampaignsTab />}
    </div>
  );
}
