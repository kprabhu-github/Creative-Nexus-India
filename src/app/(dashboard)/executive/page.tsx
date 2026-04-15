"use client";

import { useState } from "react";
import {
  TrendingUp, Users, Wallet, CreditCard,
  Clock, AlertTriangle,
  Send, Briefcase, IndianRupee,
  ArrowUpRight, ArrowDownRight, CircleDot,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

type ViewTab = "Live" | "Weekly" | "Monthly";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  dept: string;
  deptColor: string;
  status: "online" | "away" | "offline";
}

const teamTicker: TeamMember[] = [
  { id: "t1", name: "K. Prabhu", initials: "KP", dept: "Ops", deptColor: "bg-accent/10 text-accent", status: "online" },
  { id: "t2", name: "Rishabh Kumar", initials: "RK", dept: "Eng", deptColor: "bg-success/10 text-success", status: "online" },
  { id: "t3", name: "Ashish Kumar", initials: "AK", dept: "Design", deptColor: "bg-warning/10 text-warning", status: "online" },
  { id: "t4", name: "Natraj", initials: "NR", dept: "Mktg", deptColor: "bg-destructive/10 text-destructive", status: "away" },
  { id: "t5", name: "Anit Sharma", initials: "AS", dept: "Eng", deptColor: "bg-success/10 text-success", status: "online" },
  { id: "t6", name: "Priya Nair", initials: "PN", dept: "Mktg", deptColor: "bg-destructive/10 text-destructive", status: "online" },
  { id: "t7", name: "Sneha Patel", initials: "SP", dept: "Design", deptColor: "bg-warning/10 text-warning", status: "online" },
  { id: "t8", name: "Vikram Singh", initials: "VS", dept: "Eng", deptColor: "bg-success/10 text-success", status: "offline" },
  { id: "t9", name: "Meera Reddy", initials: "MR", dept: "Ops", deptColor: "bg-accent/10 text-accent", status: "online" },
  { id: "t10", name: "Karan Joshi", initials: "KJ", dept: "Mktg", deptColor: "bg-destructive/10 text-destructive", status: "away" },
  { id: "t11", name: "Anjali Gupta", initials: "AG", dept: "Ops", deptColor: "bg-accent/10 text-accent", status: "online" },
  { id: "t12", name: "Dev Patel", initials: "DP", dept: "Eng", deptColor: "bg-success/10 text-success", status: "online" },
];

interface TopClient {
  id: string;
  name: string;
  initials: string;
  revenue: string;
}

const topClients: TopClient[] = [
  { id: "rc1", name: "Acme Corp", initials: "AC", revenue: "5,50,000" },
  { id: "rc2", name: "NovaTech Solutions", initials: "NS", revenue: "4,20,000" },
  { id: "rc3", name: "Meridian Finance", initials: "MF", revenue: "4,10,000" },
  { id: "rc4", name: "Bloom Wellness", initials: "BW", revenue: "3,80,000" },
  { id: "rc5", name: "UrbanEdge Realty", initials: "UR", revenue: "3,20,000" },
];

interface ActionItem {
  id: string;
  text: string;
  type: "follow-up" | "leave" | "contract";
  priority: "high" | "medium";
}

const actionItems: ActionItem[] = [
  { id: "a1", text: "Follow up with Acme Corp on Q2 SOW", type: "follow-up", priority: "high" },
  { id: "a2", text: "Follow up with Bloom Wellness on campaign assets", type: "follow-up", priority: "medium" },
  { id: "a3", text: "Approve Natraj's leave request (Apr 18-20)", type: "leave", priority: "medium" },
  { id: "a4", text: "Zenith Retail NDA expiring in 5 days", type: "contract", priority: "high" },
];

interface ActivityEntry {
  id: string;
  text: string;
  time: string;
  module: string;
  moduleColor: string;
}

const recentActivity: ActivityEntry[] = [
  { id: "ac1", text: "Signal Engine detected 3 new leads", time: "12 min ago", module: "Signal", moduleColor: "bg-accent/10 text-accent" },
  { id: "ac2", text: "Invoice #INV-0042 paid by NovaTech", time: "28 min ago", module: "Finance", moduleColor: "bg-success/10 text-success" },
  { id: "ac3", text: "Rishabh deployed v2.4.1 to staging", time: "1 hr ago", module: "Projects", moduleColor: "bg-warning/10 text-warning" },
  { id: "ac4", text: "GTM campaign 'Q2 Outreach' launched", time: "2 hrs ago", module: "GTM", moduleColor: "bg-destructive/10 text-destructive" },
  { id: "ac5", text: "Sneha completed brand kit for UrbanEdge", time: "3 hrs ago", module: "Projects", moduleColor: "bg-warning/10 text-warning" },
  { id: "ac6", text: "Priya published 2 blog posts via Social", time: "4 hrs ago", module: "Social", moduleColor: "bg-foreground-tertiary/10 text-foreground-tertiary" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusDot(status: TeamMember["status"]) {
  switch (status) {
    case "online":
      return "bg-success";
    case "away":
      return "bg-warning";
    case "offline":
      return "bg-foreground-tertiary/40";
  }
}

function actionIcon(type: ActionItem["type"]) {
  switch (type) {
    case "follow-up":
      return <Send className="w-3.5 h-3.5 text-accent" strokeWidth={2} />;
    case "leave":
      return <Clock className="w-3.5 h-3.5 text-warning" strokeWidth={2} />;
    case "contract":
      return <AlertTriangle className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExecutivePage() {
  const [activeTab, setActiveTab] = useState<ViewTab>("Live");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Executive Overview"
        description="Real-time ops intelligence across all modules."
        actions={
          <SegmentedControl
            options={["Live", "Weekly", "Monthly"]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as ViewTab)}
          />
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard title="MRR" value={"\u20B928,50,000"} icon={TrendingUp} trend="+4.8% MoM" />
        <MetricCard title="Active Clients" value="124" icon={Users} trend="+6 this month" />
        <MetricCard title="Team Online" value="38/45" icon={CircleDot} trend="84% available" />
        <MetricCard title="Expenses" value={"\u20B98,40,000"} icon={Wallet} trend="-8% vs last month" />
      </div>

      {/* Live Team Ticker */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Live Team Status</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {teamTicker.filter((t) => t.status === "online").length} online
        </span>
      </div>
      <div className="overflow-x-auto flex gap-3 mb-5 pb-1">
        {teamTicker.map((member) => (
          <div
            key={member.id}
            className="bg-background-secondary rounded-[10px] p-3 dark:border dark:border-border shrink-0 w-[130px]"
          >
            <div className="relative w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-[11px] font-semibold text-accent">{member.initials}</span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background-secondary ${statusDot(member.status)}`}
              />
            </div>
            <div className="text-[12px] font-medium text-foreground text-center truncate">{member.name}</div>
            <div className="flex justify-center mt-1">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${member.deptColor}`}>
                {member.dept}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-3 mb-5">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-3">
          {/* Project Velocity */}
          <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-foreground">Project Velocity</span>
              <StatusBadge type="success">On Track</StatusBadge>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Tasks Done</div>
                <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">14</div>
                <div className="text-xs text-foreground-tertiary">this week</div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Capacity</div>
                <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">78%</div>
                <div className="text-xs text-foreground-tertiary">team utilization</div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Sprint</div>
                <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">23/30</div>
                <div className="text-xs text-foreground-tertiary">tasks completed</div>
              </div>
            </div>
            <ProgressBar value={23} max={30} color="accent" className="h-1.5" />
          </div>

          {/* Revenue Top 5 Clients */}
          <div className="bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden">
            <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
              <span className="text-[13px] font-semibold text-foreground">Revenue - Top 5 Clients</span>
              <button className="text-xs font-medium text-accent hover:underline">View All</button>
            </div>
            {topClients.map((client, i) => (
              <div key={client.id}>
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-accent">{client.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">{client.name}</div>
                  </div>
                  <span className="text-[13px] font-semibold text-foreground shrink-0">
                    {"\u20B9"}{client.revenue}
                  </span>
                </div>
                {i < topClients.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-3">
          {/* Action Items */}
          <div className="bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden">
            <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
              <span className="text-[13px] font-semibold text-foreground">Action Items</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10 text-[11px] font-semibold text-destructive">
                {actionItems.length}
              </span>
            </div>
            {actionItems.map((item, i) => (
              <div key={item.id}>
                <div className="flex items-start gap-2.5 px-3.5 py-2.5">
                  <div className="mt-0.5 shrink-0">{actionIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-foreground leading-snug">{item.text}</div>
                  </div>
                  {item.priority === "high" && (
                    <StatusBadge type="error" className="shrink-0">Urgent</StatusBadge>
                  )}
                </div>
                {i < actionItems.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden">
            <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
              <span className="text-[13px] font-semibold text-foreground">Recent Activity</span>
              <button className="text-xs font-medium text-accent hover:underline">View All</button>
            </div>
            {recentActivity.map((entry, i) => (
              <div key={entry.id}>
                <div className="flex items-start gap-2.5 px-3.5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-foreground leading-snug">{entry.text}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${entry.moduleColor}`}>
                        {entry.module}
                      </span>
                      <span className="text-[11px] text-foreground-tertiary">{entry.time}</span>
                    </div>
                  </div>
                </div>
                {i < recentActivity.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - Financial Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">ARR</span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {"\u20B9"}3.42Cr
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowUpRight className="w-3 h-3 text-success" strokeWidth={2} />
            <span className="text-xs font-medium text-success">+18% YoY</span>
          </div>
        </div>

        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Receivable</span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {"\u20B9"}4,85,000
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowDownRight className="w-3 h-3 text-warning" strokeWidth={2} />
            <span className="text-xs font-medium text-warning">3 invoices overdue</span>
          </div>
        </div>

        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Runway</span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">18 months</div>
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowUpRight className="w-3 h-3 text-success" strokeWidth={2} />
            <span className="text-xs font-medium text-success">Healthy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
