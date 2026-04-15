"use client";

import { useState } from "react";
import {
  UserPlus,
  Clock,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Users,
  Percent,
  Eye,
  Bell,
  Check,
  Loader2,
  FileText,
  Star,
  CalendarDays,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingStatus = "in-progress" | "awaiting-client" | "completed";
type PlanType = "Intelligence Sprint" | "Monthly" | "Full Stack";

interface OnboardingStep {
  id: number;
  label: string;
  completed: boolean;
  current: boolean;
  detail: string;
  responsible: string;
}

interface ActiveOnboarding {
  id: string;
  clientName: string;
  industry: string;
  plan: PlanType;
  startDate: string;
  assignedTo: string;
  assignedInitials: string;
  status: OnboardingStatus;
  currentStep: number;
  steps: OnboardingStep[];
}

interface CompletedOnboarding {
  id: string;
  clientName: string;
  plan: PlanType;
  completionDate: string;
  daysToComplete: number;
  qualityScore: number;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

function buildSteps(currentStep: number): OnboardingStep[] {
  const stepDefs: { label: string; detail: string; responsible: string }[] = [
    { label: "Signup", detail: "Client account created and credentials sent", responsible: "System" },
    { label: "Onboarding Form", detail: "Client filling out brand questionnaire and business details", responsible: "Client" },
    { label: "W7 Auto-Run", detail: "Brand Brief generation via AI agent W7", responsible: "AI Agent W7" },
    { label: "Brand Brief Review", detail: "Team reviewing generated brand brief for accuracy", responsible: "Account Manager" },
    { label: "Brief Approved", detail: "Client approved brief, workflows unlocked", responsible: "Client" },
    { label: "First Deliverables", detail: "Initial deliverables generated and delivered", responsible: "Delivery Team" },
  ];

  return stepDefs.map((def, i) => ({
    id: i + 1,
    label: def.label,
    completed: i + 1 < currentStep,
    current: i + 1 === currentStep,
    detail: def.detail,
    responsible: def.responsible,
  }));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const activeOnboardings: ActiveOnboarding[] = [
  {
    id: "ob1",
    clientName: "TechFlow Solutions",
    industry: "SaaS / Technology",
    plan: "Full Stack",
    startDate: "Apr 10, 2026",
    assignedTo: "Priya Nair",
    assignedInitials: "PN",
    status: "awaiting-client",
    currentStep: 4,
    steps: buildSteps(4),
  },
  {
    id: "ob2",
    clientName: "Apex Innovations",
    industry: "Manufacturing",
    plan: "Monthly",
    startDate: "Apr 14, 2026",
    assignedTo: "Sneha Patel",
    assignedInitials: "SP",
    status: "in-progress",
    currentStep: 2,
    steps: buildSteps(2),
  },
  {
    id: "ob3",
    clientName: "GreenLeaf Organics",
    industry: "Consumer / Organic Foods",
    plan: "Intelligence Sprint",
    startDate: "Mar 28, 2026",
    assignedTo: "Natraj",
    assignedInitials: "NR",
    status: "completed",
    currentStep: 6,
    steps: buildSteps(7), // all 6 completed
  },
];

const completedOnboardings: CompletedOnboarding[] = [
  {
    id: "co1",
    clientName: "Meridian Finance",
    plan: "Full Stack",
    completionDate: "Mar 20, 2026",
    daysToComplete: 5,
    qualityScore: 96,
  },
  {
    id: "co2",
    clientName: "Bloom Wellness",
    plan: "Monthly",
    completionDate: "Mar 12, 2026",
    daysToComplete: 3,
    qualityScore: 92,
  },
  {
    id: "co3",
    clientName: "UrbanEdge Realty",
    plan: "Intelligence Sprint",
    completionDate: "Feb 28, 2026",
    daysToComplete: 4,
    qualityScore: 89,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeType(status: OnboardingStatus) {
  switch (status) {
    case "in-progress":
      return "info" as const;
    case "awaiting-client":
      return "warning" as const;
    case "completed":
      return "success" as const;
  }
}

function statusLabel(status: OnboardingStatus) {
  switch (status) {
    case "in-progress":
      return "In Progress";
    case "awaiting-client":
      return "Awaiting Client";
    case "completed":
      return "Completed";
  }
}

function planBadgeType(plan: PlanType) {
  switch (plan) {
    case "Full Stack":
      return "info" as const;
    case "Monthly":
      return "success" as const;
    case "Intelligence Sprint":
      return "neutral" as const;
  }
}

function currentStepIcon(step: OnboardingStep) {
  if (step.label === "W7 Auto-Run" && step.current) {
    return <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" strokeWidth={2} />;
  }
  if (step.completed) {
    return <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={2} />;
  }
  if (step.current) {
    return <Clock className="w-3.5 h-3.5 text-accent" strokeWidth={2} />;
  }
  return <Circle className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />;
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ steps }: { steps: OnboardingStep[] }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          {/* Circle */}
          <div className="flex flex-col items-center relative">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                step.completed
                  ? "bg-success/15 ring-2 ring-success/30"
                  : step.current
                    ? "bg-accent/15 ring-2 ring-accent/40"
                    : "bg-foreground-tertiary/10 ring-1 ring-foreground-tertiary/20"
              }`}
            >
              {step.completed ? (
                <Check className="w-3.5 h-3.5 text-success" strokeWidth={2.5} />
              ) : step.current ? (
                <span className="text-[10px] font-bold text-accent">{step.id}</span>
              ) : (
                <span className="text-[10px] font-medium text-foreground-tertiary">{step.id}</span>
              )}
            </div>
            <span
              className={`text-[10px] mt-1 whitespace-nowrap absolute top-full ${
                step.completed
                  ? "font-medium text-success"
                  : step.current
                    ? "font-semibold text-accent"
                    : "font-medium text-foreground-tertiary"
              }`}
            >
              {step.label}
            </span>
          </div>

          {/* Connecting line */}
          {i < steps.length - 1 && (
            <div className="flex-1 h-[2px] mx-1.5">
              <div
                className={`h-full rounded-full transition-all ${
                  step.completed ? "bg-success/40" : "bg-foreground-tertiary/15"
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Card
// ---------------------------------------------------------------------------

function OnboardingCard({ onboarding }: { onboarding: ActiveOnboarding }) {
  const [expanded, setExpanded] = useState(false);
  const completedSteps = onboarding.steps.filter((s) => s.completed).length;
  const totalSteps = onboarding.steps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);
  const currentStep = onboarding.steps.find((s) => s.current);
  const isCompleted = onboarding.status === "completed";

  const progressColor = isCompleted
    ? ("success" as const)
    : progressPercent >= 50
      ? ("accent" as const)
      : ("warning" as const);

  return (
    <div
      className={`bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden transition-all ${
        isCompleted ? "opacity-80" : ""
      }`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-surface-hover/50 transition-colors"
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

        {/* Client avatar */}
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-accent">
            {onboarding.clientName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </span>
        </div>

        {/* Name + step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {onboarding.clientName}
            </span>
            {isCompleted && (
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" strokeWidth={2} />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-foreground-tertiary">
              Step {Math.min(onboarding.currentStep, totalSteps)} of {totalSteps}
            </span>
            <span className="text-[11px] text-foreground-tertiary">
              {currentStep ? `- ${currentStep.label}` : "- Complete"}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-[120px]">
          <ProgressBar value={progressPercent} color={progressColor} className="flex-1" />
          <span className="text-[11px] font-medium text-foreground-tertiary w-[28px] text-right">
            {progressPercent}%
          </span>
        </div>

        {/* Assigned */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-[8px] font-semibold text-accent">{onboarding.assignedInitials}</span>
          </div>
          <span className="text-[11px] text-foreground-tertiary">{onboarding.assignedTo}</span>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <StatusBadge type={statusBadgeType(onboarding.status)}>
            {statusLabel(onboarding.status)}
          </StatusBadge>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-divider bg-background dark:bg-background/40 px-4 py-3.5">
          {/* Client details row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-foreground-tertiary">Industry:</span>
              <span className="text-[12px] font-medium text-foreground">{onboarding.industry}</span>
            </div>
            <div className="w-px h-3 bg-divider" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-foreground-tertiary">Plan:</span>
              <StatusBadge type={planBadgeType(onboarding.plan)}>{onboarding.plan}</StatusBadge>
            </div>
            <div className="w-px h-3 bg-divider" />
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-foreground-tertiary" strokeWidth={2} />
              <span className="text-[11px] text-foreground-tertiary">Started:</span>
              <span className="text-[12px] font-medium text-foreground">{onboarding.startDate}</span>
            </div>
            <div className="w-px h-3 bg-divider" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-foreground-tertiary">Assigned:</span>
              <span className="text-[12px] font-medium text-foreground">{onboarding.assignedTo}</span>
            </div>
          </div>

          {/* Step indicator */}
          <div className="mb-8 px-2">
            <StepIndicator steps={onboarding.steps} />
          </div>

          {/* Step details list */}
          <div className="bg-background-secondary rounded-[8px] overflow-hidden dark:border dark:border-border mb-3">
            {onboarding.steps.map((step, i) => (
              <div key={step.id}>
                <div
                  className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                    step.current ? "bg-accent/5" : ""
                  }`}
                >
                  <div className="shrink-0">{currentStepIcon(step)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[13px] ${
                          step.completed
                            ? "text-foreground-tertiary line-through"
                            : step.current
                              ? "font-semibold text-foreground"
                              : "text-foreground-secondary"
                        }`}
                      >
                        {step.label}
                      </span>
                      {step.current && (
                        <span className="text-[10px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    {step.current && (
                      <p className="text-[11px] text-foreground-tertiary mt-0.5">{step.detail}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-foreground-tertiary shrink-0 hidden sm:inline">
                    {step.responsible}
                  </span>
                </div>
                {i < onboarding.steps.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onboarding.currentStep >= 3 && (
              <Button variant="outline" size="sm">
                <Eye className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                View Brief
              </Button>
            )}
            {!isCompleted && (
              <Button variant="outline" size="sm">
                <Bell className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                Send Reminder
              </Button>
            )}
            {!isCompleted && (
              <Button variant="outline" size="sm">
                <Check className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                Mark Complete
              </Button>
            )}
            {isCompleted && (
              <Button variant="outline" size="sm">
                <FileText className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                View Summary
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed Onboardings List
// ---------------------------------------------------------------------------

function CompletedOnboardingsList() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Completed Onboardings</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {completedOnboardings.length} clients
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {completedOnboardings.map((client, i) => (
          <div key={client.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={2} />
              </div>

              {/* Name + plan */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{client.clientName}</div>
                <div className="text-[11px] text-foreground-tertiary">{client.plan}</div>
              </div>

              {/* Completion date */}
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="text-[11px] text-foreground-tertiary">Completed</span>
                <span className="text-[12px] font-medium text-foreground">{client.completionDate}</span>
              </div>

              {/* Days to complete */}
              <div className="hidden md:flex flex-col items-end shrink-0">
                <span className="text-[11px] text-foreground-tertiary">Duration</span>
                <span className="text-[12px] font-medium text-foreground">{client.daysToComplete} days</span>
              </div>

              {/* Quality score */}
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3 h-3 text-warning fill-warning" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-foreground">{client.qualityScore}%</span>
              </div>
            </div>
            {i < completedOnboardings.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const [expandedFilter, setExpandedFilter] = useState<"all" | "active" | "completed">("all");

  const filteredOnboardings =
    expandedFilter === "active"
      ? activeOnboardings.filter((o) => o.status !== "completed")
      : expandedFilter === "completed"
        ? activeOnboardings.filter((o) => o.status === "completed")
        : activeOnboardings;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Client Onboarding"
        description="Track new client setup from signup to first deliverable"
        actions={
          <Button>
            <UserPlus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            New Client
          </Button>
        }
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard
          title="Active Onboardings"
          value="2"
          icon={Users}
          description="Currently in progress"
        />
        <MetricCard
          title="Avg Time to First Deliverable"
          value="4.2 days"
          icon={Clock}
          trend="0.8 days faster than last month"
        />
        <MetricCard
          title="Completion Rate"
          value="94%"
          icon={Percent}
          trend="+2% from last quarter"
        />
      </div>

      {/* Active Onboardings */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Active Onboardings</span>
        <div className="flex items-center gap-1">
          {(["all", "active", "completed"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setExpandedFilter(filter)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all capitalize ${
                expandedFilter === filter
                  ? "bg-accent/10 text-accent"
                  : "text-foreground-tertiary hover:text-foreground-secondary"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 mb-6">
        {filteredOnboardings.map((onboarding) => (
          <OnboardingCard key={onboarding.id} onboarding={onboarding} />
        ))}
      </div>

      {/* Completed Onboardings */}
      <CompletedOnboardingsList />
    </div>
  );
}
