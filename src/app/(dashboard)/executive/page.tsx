"use client";

import { useState } from "react";
import {
  TrendingUp, Users, Heart, AlertTriangle,
  DollarSign, Star, Clock, BrainCircuit,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface MRRMonth {
  id: string;
  month: string;
  mrr: string;
  change: string;
}

const mrrTrend: MRRMonth[] = [
  { id: "m1", month: "November 2025", mrr: "22,10,000", change: "+8.2%" },
  { id: "m2", month: "December 2025", mrr: "23,50,000", change: "+6.3%" },
  { id: "m3", month: "January 2026", mrr: "24,80,000", change: "+5.5%" },
  { id: "m4", month: "February 2026", mrr: "25,90,000", change: "+4.4%" },
  { id: "m5", month: "March 2026", mrr: "27,20,000", change: "+5.0%" },
  { id: "m6", month: "April 2026", mrr: "28,50,000", change: "+4.8%" },
];

interface TopClient {
  id: string;
  name: string;
  initials: string;
  revenue: string;
  plan: string;
}

const topClients: TopClient[] = [
  { id: "tc1", name: "Acme Corp", initials: "AC", revenue: "5,50,000", plan: "Enterprise" },
  { id: "tc2", name: "NovaTech Solutions", initials: "NS", revenue: "4,20,000", plan: "Growth" },
  { id: "tc3", name: "Meridian Finance", initials: "MF", revenue: "4,10,000", plan: "Enterprise" },
  { id: "tc4", name: "Bloom Wellness", initials: "BW", revenue: "3,80,000", plan: "Growth" },
  { id: "tc5", name: "UrbanEdge Realty", initials: "UR", revenue: "3,20,000", plan: "Starter" },
];

interface ClientHealth {
  id: string;
  name: string;
  initials: string;
  healthScore: number;
  lastActivity: string;
  plan: "Enterprise" | "Growth" | "Starter";
}

const clientHealthList: ClientHealth[] = [
  { id: "ch1", name: "Acme Corp", initials: "AC", healthScore: 96, lastActivity: "2 hrs ago", plan: "Enterprise" },
  { id: "ch2", name: "NovaTech Solutions", initials: "NS", healthScore: 88, lastActivity: "1 day ago", plan: "Growth" },
  { id: "ch3", name: "Meridian Finance", initials: "MF", healthScore: 72, lastActivity: "3 days ago", plan: "Enterprise" },
  { id: "ch4", name: "Bloom Wellness", initials: "BW", healthScore: 91, lastActivity: "5 hrs ago", plan: "Growth" },
  { id: "ch5", name: "UrbanEdge Realty", initials: "UR", healthScore: 64, lastActivity: "5 days ago", plan: "Starter" },
];

interface TopAgent {
  id: string;
  agentId: string;
  name: string;
  qualityScore: number;
  runs: number;
}

const topAgents: TopAgent[] = [
  { id: "ta1", agentId: "A01", name: "Brand Strategist", qualityScore: 97.1, runs: 142 },
  { id: "ta2", agentId: "A15", name: "Market Researcher", qualityScore: 96.3, runs: 118 },
  { id: "ta3", agentId: "A02", name: "Competitor Analyst", qualityScore: 95.8, runs: 97 },
  { id: "ta4", agentId: "A12", name: "Email Sequencer", qualityScore: 94.7, runs: 205 },
  { id: "ta5", agentId: "A05", name: "SEO Brief Writer", qualityScore: 93.4, runs: 163 },
];

function healthScoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

function planType(plan: ClientHealth["plan"]) {
  switch (plan) {
    case "Enterprise": return "info" as const;
    case "Growth": return "success" as const;
    case "Starter": return "neutral" as const;
  }
}

const tabs = ["Revenue", "Clients", "Agents"] as const;
type Tab = (typeof tabs)[number];

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

function RevenueTab() {
  return (
    <div>
      {/* MRR Trend */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">MRR Trend (6 Months)</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          INR values
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {mrrTrend.map((month, i) => (
          <div key={month.id}>
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-background dark:bg-background/40">
              <span className="text-[13px] font-medium text-foreground">{month.month}</span>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-foreground">{month.mrr}</span>
                <span className="text-xs font-medium text-success w-[50px] text-right">{month.change}</span>
              </div>
            </div>
            {i < mrrTrend.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      {/* Top Clients by Revenue */}
      <div className="flex items-center justify-between mt-5 mb-2">
        <span className="text-[13px] font-semibold text-foreground">Top 5 Clients by Revenue</span>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {topClients.map((client, i) => (
          <div key={client.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-accent">{client.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{client.name}</div>
                <div className="text-xs text-foreground-tertiary">{client.plan}</div>
              </div>
              <div className="flex items-center gap-1 text-[13px] font-semibold text-foreground shrink-0">
                <DollarSign className="w-3 h-3 text-foreground-tertiary" strokeWidth={2} />
                {client.revenue}
              </div>
            </div>
            {i < topClients.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientsTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Client Health</span>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {clientHealthList.map((client, i) => (
          <div key={client.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-accent">{client.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{client.name}</div>
                <div className="flex items-center gap-1 text-xs text-foreground-tertiary">
                  <Clock className="w-3 h-3" strokeWidth={2} />
                  {client.lastActivity}
                </div>
              </div>

              {/* Health score */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Heart className={`w-3.5 h-3.5 ${healthScoreColor(client.healthScore)}`} strokeWidth={2} />
                <span className={`text-[13px] font-semibold ${healthScoreColor(client.healthScore)}`}>
                  {client.healthScore}
                </span>
              </div>

              {/* Plan badge */}
              <StatusBadge type={planType(client.plan)}>{client.plan}</StatusBadge>
            </div>
            {i < clientHealthList.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Top 5 Agents by Quality Score</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          All time
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {topAgents.map((agent, i) => (
          <div key={agent.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-8 h-8 rounded-[8px] bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-accent">{agent.agentId}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{agent.name}</div>
              </div>

              {/* Quality score */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Star className="w-3.5 h-3.5 text-success" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-success">{agent.qualityScore}%</span>
              </div>

              {/* Run count */}
              <div className="flex items-center gap-1 text-xs text-foreground-tertiary w-[70px] shrink-0">
                <BrainCircuit className="w-3 h-3" strokeWidth={2} />
                {agent.runs} runs
              </div>
            </div>
            {i < topAgents.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExecutivePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Revenue");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Insights"
        description="Revenue, client health, team performance, and module-level KPIs."
        actions={
          <SegmentedControl
            options={[...tabs]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
          />
        }
      />

      {/* Big Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard title="MRR" value="28.5L" icon={TrendingUp} trend="+4.8% MoM" />
        <MetricCard title="Active Clients" value="124" icon={Users} trend="+6 this month" />
        <MetricCard title="Avg LTV" value="18.2L" icon={DollarSign} trend="+12% YoY" />
        <MetricCard title="Churn Rate" value="2.1%" icon={AlertTriangle} description="Below 3% target" />
      </div>

      {activeTab === "Revenue" && <RevenueTab />}
      {activeTab === "Clients" && <ClientsTab />}
      {activeTab === "Agents" && <AgentsTab />}
    </div>
  );
}
