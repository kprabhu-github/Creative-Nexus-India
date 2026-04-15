"use client";

import { useState } from "react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  Star,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Deliverable {
  id: string;
  title: string;
  status: "completed" | "pending" | "in-progress" | "overdue";
  dueDate: string;
}

interface TeamMember {
  initials: string;
  name: string;
  color: string;
}

interface ActiveProject {
  id: string;
  name: string;
  client: string;
  completedDeliverables: number;
  totalDeliverables: number;
  deadline: string;
  status: "on-track" | "at-risk" | "overdue";
  team: TeamMember[];
  deliverables: Deliverable[];
}

interface CompletedProject {
  id: string;
  name: string;
  client: string;
  completionDate: string;
  totalDeliverables: number;
  qualityScore: number;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const activeProjects: ActiveProject[] = [
  {
    id: "p1",
    name: "Q2 Brand Refresh",
    client: "Acme Corp",
    completedDeliverables: 6,
    totalDeliverables: 10,
    deadline: "Apr 30, 2026",
    status: "on-track",
    team: [
      { initials: "SM", name: "Sarah Mitchell", color: "bg-accent" },
      { initials: "RK", name: "Raj Kumar", color: "bg-success" },
      { initials: "LP", name: "Lisa Park", color: "bg-warning" },
    ],
    deliverables: [
      { id: "d1", title: "Brand audit report", status: "completed", dueDate: "Apr 5" },
      { id: "d2", title: "Logo redesign concepts (3 options)", status: "completed", dueDate: "Apr 10" },
      { id: "d3", title: "Brand guidelines document", status: "in-progress", dueDate: "Apr 18" },
      { id: "d4", title: "Social media template kit", status: "pending", dueDate: "Apr 25" },
    ],
  },
  {
    id: "p2",
    name: "SaaS Launch Campaign",
    client: "NovaTech Solutions",
    completedDeliverables: 4,
    totalDeliverables: 8,
    deadline: "May 15, 2026",
    status: "on-track",
    team: [
      { initials: "AM", name: "Aisha Mehta", color: "bg-accent" },
      { initials: "TJ", name: "Tom Jensen", color: "bg-destructive" },
    ],
    deliverables: [
      { id: "d5", title: "Go-to-market strategy deck", status: "completed", dueDate: "Apr 1" },
      { id: "d6", title: "Landing page wireframes", status: "completed", dueDate: "Apr 8" },
      { id: "d7", title: "Email nurture sequence (6 emails)", status: "in-progress", dueDate: "Apr 20" },
      { id: "d8", title: "Paid media creative set", status: "pending", dueDate: "May 1" },
    ],
  },
  {
    id: "p3",
    name: "Annual Report Design",
    client: "Meridian Finance",
    completedDeliverables: 2,
    totalDeliverables: 6,
    deadline: "Apr 22, 2026",
    status: "at-risk",
    team: [
      { initials: "LP", name: "Lisa Park", color: "bg-warning" },
      { initials: "DW", name: "Derek Wang", color: "bg-success" },
      { initials: "NK", name: "Nina Kapoor", color: "bg-accent" },
    ],
    deliverables: [
      { id: "d9", title: "Data visualization concepts", status: "completed", dueDate: "Apr 3" },
      { id: "d10", title: "Cover and layout design", status: "completed", dueDate: "Apr 8" },
      { id: "d11", title: "Infographic suite (8 graphics)", status: "in-progress", dueDate: "Apr 16" },
      { id: "d12", title: "Final print-ready file", status: "pending", dueDate: "Apr 22" },
    ],
  },
  {
    id: "p4",
    name: "E-commerce SEO Overhaul",
    client: "Bloom Wellness",
    completedDeliverables: 1,
    totalDeliverables: 7,
    deadline: "Apr 18, 2026",
    status: "overdue",
    team: [
      { initials: "RK", name: "Raj Kumar", color: "bg-success" },
      { initials: "SM", name: "Sarah Mitchell", color: "bg-accent" },
    ],
    deliverables: [
      { id: "d13", title: "Technical SEO audit", status: "completed", dueDate: "Apr 2" },
      { id: "d14", title: "Keyword research & mapping", status: "overdue", dueDate: "Apr 10" },
      { id: "d15", title: "On-page optimization (50 pages)", status: "pending", dueDate: "Apr 14" },
      { id: "d16", title: "Content brief pack (12 briefs)", status: "pending", dueDate: "Apr 18" },
    ],
  },
];

const completedProjects: CompletedProject[] = [
  {
    id: "cp1",
    name: "Website Redesign",
    client: "Apex Industries",
    completionDate: "Mar 28, 2026",
    totalDeliverables: 12,
    qualityScore: 94,
  },
  {
    id: "cp2",
    name: "Product Launch Video Series",
    client: "Zenith Health",
    completionDate: "Mar 15, 2026",
    totalDeliverables: 8,
    qualityScore: 91,
  },
  {
    id: "cp3",
    name: "Holiday Campaign 2025",
    client: "Stellar Retail",
    completionDate: "Feb 20, 2026",
    totalDeliverables: 15,
    qualityScore: 97,
  },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const tabs = ["Active", "Completed"] as const;
type Tab = (typeof tabs)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectStatusType(status: ActiveProject["status"]) {
  switch (status) {
    case "on-track":
      return "success" as const;
    case "at-risk":
      return "warning" as const;
    case "overdue":
      return "error" as const;
  }
}

function projectStatusLabel(status: ActiveProject["status"]) {
  switch (status) {
    case "on-track":
      return "On Track";
    case "at-risk":
      return "At Risk";
    case "overdue":
      return "Overdue";
  }
}

function deliverableIcon(status: Deliverable["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={2} />;
    case "in-progress":
      return <Clock className="w-3.5 h-3.5 text-accent" strokeWidth={2} />;
    case "overdue":
      return <AlertTriangle className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />;
    case "pending":
      return <Circle className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />;
  }
}

function deliverableStatusLabel(status: Deliverable["status"]) {
  switch (status) {
    case "completed":
      return "Done";
    case "in-progress":
      return "In Progress";
    case "overdue":
      return "Overdue";
    case "pending":
      return "Pending";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
        </div>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-bold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

function ProjectCard({ project }: { project: ActiveProject }) {
  const [expanded, setExpanded] = useState(false);
  const progressPercent = (project.completedDeliverables / project.totalDeliverables) * 100;
  const progressColor =
    project.status === "overdue"
      ? "warning" as const
      : project.status === "at-risk"
        ? "warning" as const
        : "accent" as const;

  return (
    <div className="bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden">
      {/* Main project row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3.5 py-3 flex items-center gap-3 hover:bg-surface-hover/50 transition-colors"
        aria-expanded={expanded}
      >
        {/* Expand indicator */}
        <div className="shrink-0 text-foreground-tertiary">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {project.client}
            </span>
            <span className="text-[12px] text-foreground-tertiary hidden sm:inline">
              &mdash;
            </span>
            <span className="text-[12px] text-foreground-secondary truncate hidden sm:inline">
              {project.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1 max-w-[180px]">
              <ProgressBar value={progressPercent} color={progressColor} />
            </div>
            <span className="text-[11px] font-medium text-foreground-tertiary whitespace-nowrap">
              {project.completedDeliverables}/{project.totalDeliverables} deliverables
            </span>
          </div>
        </div>

        {/* Deadline */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <CalendarDays className="w-3 h-3 text-foreground-tertiary" strokeWidth={2} />
          <span className="text-[12px] text-foreground-tertiary">{project.deadline}</span>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <StatusBadge type={projectStatusType(project.status)}>
            {projectStatusLabel(project.status)}
          </StatusBadge>
        </div>

        {/* Team avatars */}
        <div className="hidden lg:flex items-center -space-x-1.5 shrink-0">
          {project.team.map((member) => (
            <div
              key={member.initials}
              className={`w-6 h-6 rounded-full ${member.color} flex items-center justify-center ring-2 ring-background-secondary`}
              title={member.name}
            >
              <span className="text-[9px] font-semibold text-white leading-none">
                {member.initials}
              </span>
            </div>
          ))}
        </div>
      </button>

      {/* Expanded deliverables */}
      {expanded && (
        <div className="border-t border-divider bg-background dark:bg-background/40">
          {project.deliverables.map((deliverable, i) => (
            <div key={deliverable.id}>
              <div className="flex items-center gap-3 px-3.5 py-2 pl-10">
                <div className="shrink-0">{deliverableIcon(deliverable.status)}</div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-[13px] ${
                      deliverable.status === "completed"
                        ? "text-foreground-tertiary line-through"
                        : "text-foreground"
                    }`}
                  >
                    {deliverable.title}
                  </span>
                </div>
                <span className="text-[11px] text-foreground-tertiary shrink-0 hidden sm:inline">
                  {deliverableStatusLabel(deliverable.status)}
                </span>
                <span className="text-[11px] text-foreground-tertiary shrink-0">
                  {deliverable.dueDate}
                </span>
              </div>
              {i < project.deliverables.length - 1 && (
                <div className="h-px bg-divider ml-10 mr-3.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompletedProjectCard({ project }: { project: CompletedProject }) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-[7px] bg-success/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={2} />
        </div>
        <StatusBadge type="success">Completed</StatusBadge>
      </div>

      <div className="text-[13px] font-semibold text-foreground leading-tight">
        {project.client}
      </div>
      <div className="text-[12px] text-foreground-secondary mt-0.5">{project.name}</div>

      <div className="h-px bg-divider my-2.5" />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[11px] text-foreground-tertiary">Completed</div>
          <div className="text-[13px] font-medium text-foreground mt-0.5">
            {project.completionDate}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground-tertiary">Deliverables</div>
          <div className="text-[13px] font-medium text-foreground mt-0.5">
            {project.totalDeliverables}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground-tertiary">Quality</div>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-warning fill-warning" strokeWidth={2} />
            <span className="text-[13px] font-semibold text-foreground">{project.qualityScore}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Tab
// ---------------------------------------------------------------------------

function ActiveTab() {
  return (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard label="Active Projects" value={8} icon={Briefcase} />
        <MetricCard label="Due This Week" value={5} icon={CalendarDays} />
        <MetricCard label="On-Track Rate" value="87%" icon={TrendingUp} />
      </div>

      {/* Project list */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Projects</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          4 of 8 shown
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {activeProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed Tab
// ---------------------------------------------------------------------------

function CompletedTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Completed Projects</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          3 projects
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {completedProjects.map((project) => (
          <CompletedProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Active");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Projects"
        description="Track client projects, deliverables, and timelines."
        actions={
          <SegmentedControl
            options={[...tabs]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
          />
        }
      />

      {activeTab === "Active" && <ActiveTab />}
      {activeTab === "Completed" && <CompletedTab />}
    </div>
  );
}
