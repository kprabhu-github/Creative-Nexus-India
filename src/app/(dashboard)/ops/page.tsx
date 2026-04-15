"use client";

import { useState } from "react";
import { BrainCircuit, Gauge, Play, DollarSign, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type Tier = "Strategy" | "Execution" | "Research";
type AgentStatus = "Active" | "Idle" | "Error";

interface Agent {
  id: string;
  agentId: string;
  name: string;
  tier: Tier;
  status: AgentStatus;
  qualityScore: number;
  lastRun: string;
}

const agents: Agent[] = [
  { id: "a1", agentId: "A01", name: "Brand Strategist", tier: "Strategy", status: "Active", qualityScore: 97.1, lastRun: "2 min ago" },
  { id: "a2", agentId: "A02", name: "Competitor Analyst", tier: "Strategy", status: "Active", qualityScore: 95.8, lastRun: "5 min ago" },
  { id: "a3", agentId: "A05", name: "SEO Brief Writer", tier: "Execution", status: "Active", qualityScore: 93.4, lastRun: "12 min ago" },
  { id: "a4", agentId: "A08", name: "Social Content Gen", tier: "Execution", status: "Idle", qualityScore: 91.2, lastRun: "1 hr ago" },
  { id: "a5", agentId: "A12", name: "Email Sequencer", tier: "Execution", status: "Active", qualityScore: 94.7, lastRun: "8 min ago" },
  { id: "a6", agentId: "A15", name: "Market Researcher", tier: "Research", status: "Active", qualityScore: 96.3, lastRun: "3 min ago" },
  { id: "a7", agentId: "A20", name: "Keyword Scout", tier: "Research", status: "Error", qualityScore: 88.5, lastRun: "30 min ago" },
  { id: "a8", agentId: "A25", name: "Voice Compliance", tier: "Strategy", status: "Active", qualityScore: 92.9, lastRun: "15 min ago" },
];

function tierType(tier: Tier) {
  switch (tier) {
    case "Strategy": return "info" as const;
    case "Execution": return "success" as const;
    case "Research": return "warning" as const;
  }
}

function agentStatusType(status: AgentStatus) {
  switch (status) {
    case "Active": return "success" as const;
    case "Idle": return "neutral" as const;
    case "Error": return "error" as const;
  }
}

const filters = ["All", "Strategy", "Execution", "Research"] as const;
type Filter = (typeof filters)[number];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OpsPage() {
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = filter === "All"
    ? agents
    : agents.filter((a) => a.tier === filter);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Agent Lab"
        description="Monitor agent runs, quality scores, prompt versions, and API costs."
        actions={
          <SegmentedControl
            options={[...filters]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
          />
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard title="Active Agents" value="13/36" icon={BrainCircuit} description="36% utilization" />
        <MetricCard title="Avg Quality Score" value="94.2%" icon={Gauge} trend="+1.8% this week" />
        <MetricCard title="Runs Today" value="47" icon={Play} trend="+12 vs yesterday" />
        <MetricCard title="Avg Cost / Run" value="42" icon={DollarSign} description="Down 8% from last week" />
      </div>

      {/* Agent List */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Agent Directory</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {filtered.length} agents
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {filtered.map((agent, i) => (
          <div key={agent.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              {/* Agent ID badge */}
              <div className="w-8 h-8 rounded-[8px] bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-accent">{agent.agentId}</span>
              </div>

              {/* Agent info */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{agent.name}</div>
              </div>

              {/* Tier badge */}
              <StatusBadge type={tierType(agent.tier)}>{agent.tier}</StatusBadge>

              {/* Quality score */}
              <div className="text-right w-[60px] shrink-0">
                <div className={`text-[13px] font-semibold ${agent.qualityScore >= 90 ? "text-success" : "text-warning"}`}>
                  {agent.qualityScore}%
                </div>
              </div>

              {/* Last run */}
              <div className="flex items-center gap-1 text-xs text-foreground-tertiary w-[80px] shrink-0">
                <Clock className="w-3 h-3" strokeWidth={2} />
                {agent.lastRun}
              </div>

              {/* Status */}
              <StatusBadge type={agentStatusType(agent.status)}>{agent.status}</StatusBadge>
            </div>
            {i < filtered.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}
