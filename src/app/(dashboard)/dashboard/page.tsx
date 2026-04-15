"use client";

import { useState } from "react";
import { Activity, DollarSign, Users, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";

export default function DashboardHome() {
  const [period, setPeriod] = useState("Day");

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-[13px] text-foreground-tertiary mt-0.5">Your agency at a glance</p>
        </div>
        <SegmentedControl
          options={["Day", "Week", "Month"]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard title="Revenue" value="$45,231" icon={DollarSign} trend="+20.1%" />
        <MetricCard title="Active Clients" value="124" icon={Users} trend="+4 this week" />
        <MetricCard title="Agent Uptime" value="99.9%" icon={Activity} description="13 agents" />
      </div>

      <div className="flex items-center justify-between mt-5">
        <span className="text-[13px] font-semibold text-foreground">Recent Activity</span>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <div className="mt-2 bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {[
          { title: "Strategy Gen W1", desc: "Competitor analysis completed", time: "Now", alert: false },
          { title: "Brand Brief — Acme Co", desc: "Awaiting client approval", time: "2m", alert: false },
          { title: "Quality Alert — Voice Drift", desc: "Needs attention", time: "5m", alert: true },
        ].map((item, i, arr) => (
          <div key={i}>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-7 h-7 rounded-full bg-background-secondary flex items-center justify-center shrink-0 dark:bg-foreground-tertiary/10">
                {item.alert ? (
                  <AlertCircle className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{item.title}</div>
                <div className={`text-xs ${item.alert ? "text-accent" : "text-foreground-tertiary"}`}>
                  {item.desc}
                </div>
              </div>
              <span className="text-xs text-foreground-tertiary shrink-0">{item.time}</span>
            </div>
            {i < arr.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Workflows Today</div>
          <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">
            8 <span className="text-[13px] font-normal text-foreground-tertiary">/ 12 target</span>
          </div>
          <ProgressBar value={8} max={12} color="accent" className="mt-2" />
        </div>
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Quality Score</div>
          <div className="text-xl font-bold text-foreground tracking-tight mt-0.5">
            94% <span className="text-[13px] font-normal text-success">▲ 2.1%</span>
          </div>
          <ProgressBar value={94} color="success" className="mt-2" />
        </div>
      </div>
    </div>
  );
}
