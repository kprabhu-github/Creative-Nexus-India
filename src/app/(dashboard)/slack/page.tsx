"use client";

import { Hash, Bot, Bell, Users, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Channel {
  id: string;
  name: string;
  description: string;
  members: number;
  lastActivity: string;
  notifications: "All" | "Mentions" | "Muted";
}

const channels: Channel[] = [
  { id: "c1", name: "#general", description: "Company-wide announcements and updates", members: 45, lastActivity: "2 min ago", notifications: "All" },
  { id: "c2", name: "#client-updates", description: "Client deliverable status and feedback", members: 28, lastActivity: "15 min ago", notifications: "All" },
  { id: "c3", name: "#signal-alerts", description: "AI agent alerts and workflow notifications", members: 12, lastActivity: "5 min ago", notifications: "Mentions" },
  { id: "c4", name: "#dev-ops", description: "Engineering deployments and infrastructure", members: 8, lastActivity: "1 hr ago", notifications: "All" },
  { id: "c5", name: "#marketing", description: "Campaign planning and creative reviews", members: 15, lastActivity: "30 min ago", notifications: "Mentions" },
  { id: "c6", name: "#random", description: "Water cooler, memes, and team bonding", members: 42, lastActivity: "Just now", notifications: "Muted" },
];

function notifType(n: Channel["notifications"]) {
  switch (n) {
    case "All": return "success" as const;
    case "Mentions": return "info" as const;
    case "Muted": return "neutral" as const;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SlackPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Channels"
        description="Channel management, bot commands, and notification rules."
      />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard title="Active Channels" value="12" icon={MessageSquare} description="6 shown below" />
        <MetricCard title="Bot Commands Today" value="34" icon={Bot} trend="+12 vs yesterday" />
        <MetricCard title="Alerts Sent" value="8" icon={Bell} description="3 critical, 5 info" />
      </div>

      {/* Channel List */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Channels</span>
        <button className="text-xs font-medium text-accent hover:underline">Manage All</button>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {channels.map((ch, i) => (
          <div key={ch.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              {/* Channel icon */}
              <div className="w-8 h-8 rounded-[8px] bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
                <Hash className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
              </div>

              {/* Channel info */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{ch.name}</div>
                <div className="text-xs text-foreground-tertiary">{ch.description}</div>
              </div>

              {/* Members */}
              <div className="flex items-center gap-1 text-xs text-foreground-tertiary shrink-0">
                <Users className="w-3 h-3" strokeWidth={2} />
                {ch.members}
              </div>

              {/* Last activity */}
              <span className="text-[11px] text-foreground-tertiary w-[80px] text-right shrink-0">{ch.lastActivity}</span>

              {/* Notification status */}
              <StatusBadge type={notifType(ch.notifications)} className="ml-1">
                {ch.notifications}
              </StatusBadge>
            </div>
            {i < channels.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}
