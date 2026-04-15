"use client";

import { useState } from "react";
import {
  Users, UserCheck, UserMinus, Briefcase,
  Star, Mail, Phone, Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

type Department = "Engineering" | "Design" | "Marketing" | "Operations";
type OnlineStatus = "Online" | "Away" | "Offline";

interface Employee {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: Department;
  score: number;
  status: OnlineStatus;
}

const employees: Employee[] = [
  { id: "e1", name: "K. Prabhu", initials: "KP", role: "CEO", department: "Operations", score: 4.9, status: "Online" },
  { id: "e2", name: "Rishabh Kumar", initials: "RK", role: "CTO", department: "Engineering", score: 4.7, status: "Online" },
  { id: "e3", name: "Ashish Kumar", initials: "AK", role: "Lead Designer", department: "Design", score: 4.5, status: "Online" },
  { id: "e4", name: "Natraj", initials: "NR", role: "Marketing Head", department: "Marketing", score: 4.3, status: "Away" },
  { id: "e5", name: "Anit Sharma", initials: "AS", role: "Frontend Dev", department: "Engineering", score: 4.1, status: "Online" },
  { id: "e6", name: "Priya Nair", initials: "PN", role: "Content Strategist", department: "Marketing", score: 4.4, status: "Online" },
  { id: "e7", name: "Sneha Patel", initials: "SP", role: "UI/UX Designer", department: "Design", score: 4.2, status: "Online" },
  { id: "e8", name: "Vikram Singh", initials: "VS", role: "Backend Dev", department: "Engineering", score: 3.9, status: "Offline" },
  { id: "e9", name: "Meera Reddy", initials: "MR", role: "Ops Manager", department: "Operations", score: 4.6, status: "Online" },
  { id: "e10", name: "Karan Joshi", initials: "KJ", role: "SEO Specialist", department: "Marketing", score: 4.0, status: "Away" },
  { id: "e11", name: "Anjali Gupta", initials: "AG", role: "HR Manager", department: "Operations", score: 4.3, status: "Online" },
  { id: "e12", name: "Dev Patel", initials: "DP", role: "DevOps Engineer", department: "Engineering", score: 4.1, status: "Online" },
];

const filters = ["All", "Engineering", "Design", "Marketing", "Operations"] as const;
type Filter = (typeof filters)[number];

const deptAvatarColor: Record<Department, string> = {
  Engineering: "bg-success/15 text-success",
  Design: "bg-warning/15 text-warning",
  Marketing: "bg-destructive/15 text-destructive",
  Operations: "bg-accent/15 text-accent",
};

const deptBadgeColor: Record<Department, string> = {
  Engineering: "bg-success/10 text-success",
  Design: "bg-warning/10 text-warning",
  Marketing: "bg-destructive/10 text-destructive",
  Operations: "bg-accent/10 text-accent",
};

function statusDot(status: OnlineStatus) {
  switch (status) {
    case "Online":
      return "bg-success";
    case "Away":
      return "bg-warning";
    case "Offline":
      return "bg-foreground-tertiary/40";
  }
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PeoplePage() {
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  const filtered = employees.filter((emp) => {
    const matchesDept = filter === "All" || emp.department === filter;
    const matchesSearch =
      search === "" ||
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.role.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Team Directory"
        description="Employee directory, roles, and performance overview."
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={[...filters]}
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
            />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 pl-8 pr-3 text-xs font-medium rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 w-[160px] transition-all"
              />
            </div>
          </div>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard title="Total Employees" value="45" icon={Users} trend="+3 this quarter" />
        <MetricCard title="Active Now" value="38" icon={UserCheck} description="Online or in office" />
        <MetricCard title="On Leave" value="3" icon={UserMinus} description="2 planned, 1 sick" />
        <MetricCard title="Open Positions" value="4" icon={Briefcase} description="2 Eng, 1 Design, 1 Ops" />
      </div>

      {/* Directory Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Employee Directory</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <div className="bg-background-secondary rounded-[10px] p-8 dark:border dark:border-border text-center">
          <span className="text-[13px] text-foreground-tertiary">No employees match your search.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border hover:shadow-sm transition-shadow"
            >
              {/* Top: Avatar + Status + Dept */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${deptAvatarColor[emp.department]}`}>
                      <span className="text-[14px] font-bold">{emp.initials}</span>
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background-secondary ${statusDot(emp.status)}`}
                    />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-foreground">{emp.name}</div>
                    <div className="text-[12px] text-foreground-tertiary">{emp.role}</div>
                  </div>
                </div>
              </div>

              {/* Middle: Dept Badge + Score */}
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${deptBadgeColor[emp.department]}`}>
                  {emp.department}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-warning fill-warning" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-foreground">{emp.score}</span>
                </div>
              </div>

              {/* Bottom: Actions */}
              <div className="flex items-center justify-between pt-2.5 border-t border-divider">
                <div className="flex items-center gap-1.5">
                  <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-hover transition-colors">
                    <Mail className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
                  </button>
                  <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-hover transition-colors">
                    <Phone className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
                  </button>
                </div>
                <Button variant="ghost" size="xs">
                  View Profile
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
