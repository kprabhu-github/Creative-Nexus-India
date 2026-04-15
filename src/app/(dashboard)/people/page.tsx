"use client";

import { useState } from "react";
import { Users, UserMinus, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: "Engineering" | "Design" | "Marketing" | "Operations";
  status: "Active" | "On Leave";
}

const employees: Employee[] = [
  { id: "e1", name: "Arjun Mehta", initials: "AM", role: "Lead Engineer", department: "Engineering", status: "Active" },
  { id: "e2", name: "Priya Sharma", initials: "PS", role: "Senior Designer", department: "Design", status: "Active" },
  { id: "e3", name: "Rahul Verma", initials: "RV", role: "Frontend Developer", department: "Engineering", status: "On Leave" },
  { id: "e4", name: "Sneha Patel", initials: "SP", role: "Content Strategist", department: "Marketing", status: "Active" },
  { id: "e5", name: "Vikram Singh", initials: "VS", role: "Backend Developer", department: "Engineering", status: "Active" },
  { id: "e6", name: "Anjali Gupta", initials: "AG", role: "UI Designer", department: "Design", status: "On Leave" },
  { id: "e7", name: "Karan Joshi", initials: "KJ", role: "SEO Specialist", department: "Marketing", status: "Active" },
  { id: "e8", name: "Meera Reddy", initials: "MR", role: "Operations Manager", department: "Operations", status: "Active" },
];

const departmentColors: Record<Employee["department"], string> = {
  Engineering: "bg-accent/10 text-accent",
  Design: "bg-success/10 text-success",
  Marketing: "bg-warning/10 text-warning",
  Operations: "bg-foreground-tertiary/10 text-foreground-tertiary",
};

const filters = ["All", "Engineering", "Design", "Marketing"] as const;
type Filter = (typeof filters)[number];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PeoplePage() {
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = filter === "All"
    ? employees
    : employees.filter((e) => e.department === filter);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Team"
        description="Employee directory, org chart, leaves, payroll, and HR operations."
        actions={
          <SegmentedControl
            options={[...filters]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
          />
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard title="Total Employees" value="45" icon={Users} trend="+3 this month" />
        <MetricCard title="On Leave Today" value="3" icon={UserMinus} description="2 planned, 1 sick" />
        <MetricCard title="Open Positions" value="4" icon={Briefcase} description="2 engineering, 1 design, 1 ops" />
      </div>

      {/* Employee Directory */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Employee Directory</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {filtered.map((emp, i) => (
          <div key={emp.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold text-accent">{emp.initials}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{emp.name}</div>
                <div className="text-xs text-foreground-tertiary">{emp.role}</div>
              </div>

              {/* Department badge */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${departmentColors[emp.department]}`}>
                {emp.department}
              </span>

              {/* Status */}
              <StatusBadge type={emp.status === "Active" ? "success" : "warning"}>
                {emp.status}
              </StatusBadge>
            </div>
            {i < filtered.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}
