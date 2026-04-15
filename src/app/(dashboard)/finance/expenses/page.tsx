"use client";

import { useState } from "react";
import {
  Plus,
  Plane,
  Monitor,
  Building2,
  Megaphone,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClaimCategory =
  | "Travel"
  | "Software"
  | "Office"
  | "Marketing"
  | "Client Entertainment";

type ClaimStatus =
  | "Pending PM"
  | "Pending Admin"
  | "Approved"
  | "Rejected"
  | "Reimbursed";

interface ExpenseClaim {
  id: string;
  category: ClaimCategory;
  description: string;
  employee: string;
  amount: string;
  amountNumeric: number;
  date: string;
  status: ClaimStatus;
  approver: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const claims: ExpenseClaim[] = [
  {
    id: "ec-1",
    category: "Travel",
    description: "Mumbai client meeting \u2014 flight + hotel",
    employee: "Anit Sharma",
    amount: "25,000",
    amountNumeric: 25000,
    date: "Apr 3, 2026",
    status: "Approved",
    approver: "K. Prabhu",
  },
  {
    id: "ec-2",
    category: "Software",
    description: "Figma annual license",
    employee: "Ashish Kumar",
    amount: "18,000",
    amountNumeric: 18000,
    date: "Apr 5, 2026",
    status: "Approved",
    approver: "Dev Patel",
  },
  {
    id: "ec-3",
    category: "Marketing",
    description: "LinkedIn Ads Q2 campaign",
    employee: "Natraj",
    amount: "65,000",
    amountNumeric: 65000,
    date: "Apr 8, 2026",
    status: "Pending Admin",
    approver: "K. Prabhu",
  },
  {
    id: "ec-4",
    category: "Office",
    description: "Standing desks (3)",
    employee: "Meera Reddy",
    amount: "45,000",
    amountNumeric: 45000,
    date: "Apr 9, 2026",
    status: "Pending PM",
    approver: "Anit Sharma",
  },
  {
    id: "ec-5",
    category: "Client Entertainment",
    description: "Dinner with Razorpay team",
    employee: "K. Prabhu",
    amount: "8,500",
    amountNumeric: 8500,
    date: "Apr 10, 2026",
    status: "Approved",
    approver: "Natraj",
  },
  {
    id: "ec-6",
    category: "Travel",
    description: "Bangalore conference",
    employee: "Rishabh Kumar",
    amount: "32,000",
    amountNumeric: 32000,
    date: "Apr 11, 2026",
    status: "Pending PM",
    approver: "Meera Reddy",
  },
  {
    id: "ec-7",
    category: "Software",
    description: "Anthropic API credits",
    employee: "Dev Patel",
    amount: "1,85,000",
    amountNumeric: 185000,
    date: "Apr 12, 2026",
    status: "Approved",
    approver: "K. Prabhu",
  },
  {
    id: "ec-8",
    category: "Marketing",
    description: "Event sponsorship",
    employee: "Karan Joshi",
    amount: "15,000",
    amountNumeric: 15000,
    date: "Apr 7, 2026",
    status: "Rejected",
    approver: "K. Prabhu",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const filterTabs = ["All", "Pending", "Approved", "Rejected"] as const;
type FilterTab = (typeof filterTabs)[number];

function categoryIcon(category: ClaimCategory) {
  switch (category) {
    case "Travel":
      return Plane;
    case "Software":
      return Monitor;
    case "Office":
      return Building2;
    case "Marketing":
      return Megaphone;
    case "Client Entertainment":
      return UtensilsCrossed;
  }
}

function categoryColor(category: ClaimCategory): string {
  switch (category) {
    case "Travel":
      return "bg-accent/10 text-accent";
    case "Software":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "Office":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "Marketing":
      return "bg-pink-500/10 text-pink-600 dark:text-pink-400";
    case "Client Entertainment":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
}

function statusBadgeType(status: ClaimStatus) {
  switch (status) {
    case "Pending PM":
      return "warning" as const;
    case "Pending Admin":
      return "info" as const;
    case "Approved":
      return "success" as const;
    case "Rejected":
      return "error" as const;
    case "Reimbursed":
      return "neutral" as const;
  }
}

function filterClaims(
  allClaims: ExpenseClaim[],
  tab: FilterTab
): ExpenseClaim[] {
  switch (tab) {
    case "All":
      return allClaims;
    case "Pending":
      return allClaims.filter(
        (c) => c.status === "Pending PM" || c.status === "Pending Admin"
      );
    case "Approved":
      return allClaims.filter(
        (c) => c.status === "Approved" || c.status === "Reimbursed"
      );
    case "Rejected":
      return allClaims.filter((c) => c.status === "Rejected");
  }
}

// ---------------------------------------------------------------------------
// Metric card (local variant with icon badge + sublabel)
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: LucideIcon;
  iconColor: string;
}) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-[7px] ${iconColor} flex items-center justify-center shrink-0`}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-bold text-foreground tracking-tight">
        {value}
      </div>
      <div className="text-xs font-medium text-foreground-tertiary mt-0.5">
        {sublabel}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpenseClaimsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  const filtered = filterClaims(claims, activeTab);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Expense Claims"
        description="Submit and track expense reimbursements"
        actions={
          <>
            <SegmentedControl
              options={[...filterTabs]}
              value={activeTab}
              onChange={(v) => setActiveTab(v as FilterTab)}
            />
            <Button className="bg-accent text-white hover:bg-accent/90 border-transparent">
              <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
              New Claim
            </Button>
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <SummaryCard
          label="Total Claims"
          value="23"
          sublabel="This month"
          icon={Receipt}
          iconColor="bg-accent/10 text-accent"
        />
        <SummaryCard
          label="Pending Approval"
          value={"\u20B91,45,000"}
          sublabel="5 claims"
          icon={Clock}
          iconColor="bg-warning/10 text-warning"
        />
        <SummaryCard
          label="Approved"
          value={"\u20B93,20,000"}
          sublabel="14 claims"
          icon={CheckCircle2}
          iconColor="bg-success/10 text-success"
        />
        <SummaryCard
          label="Rejected"
          value={"\u20B935,000"}
          sublabel="2 claims"
          icon={XCircle}
          iconColor="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Claims List */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">
          {activeTab === "All" ? "All Claims" : `${activeTab} Claims`}
        </span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {filtered.length} {filtered.length === 1 ? "claim" : "claims"}
        </span>
      </div>

      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {/* Table header */}
        <div className="flex items-center gap-3 px-3.5 py-2 border-b border-divider">
          <div className="w-8 shrink-0" />
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider flex-1 min-w-0">
            Description
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[120px]">
            Submitted By
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[100px] text-right">
            Amount
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[90px] text-right">
            Date
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[110px] text-right">
            Status
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[100px] text-right">
            Approver
          </span>
        </div>

        {/* Claims rows */}
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-[13px] text-foreground-tertiary">
              No claims match this filter.
            </span>
          </div>
        ) : (
          filtered.map((claim, i) => {
            const Icon = categoryIcon(claim.category);
            const color = categoryColor(claim.category);

            return (
              <div key={claim.id}>
                <div className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer">
                  {/* Category icon */}
                  <div
                    className={`w-8 h-8 rounded-full ${color} flex items-center justify-center shrink-0`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  </div>

                  {/* Description + category tag */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {claim.description}
                      </span>
                      <span className="text-[11px] font-medium text-foreground-tertiary bg-foreground-tertiary/8 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        {claim.category}
                      </span>
                    </div>
                  </div>

                  {/* Employee */}
                  <span className="text-[13px] text-foreground w-[120px] truncate">
                    {claim.employee}
                  </span>

                  {/* Amount */}
                  <span className="text-[13px] font-semibold text-foreground w-[100px] text-right tabular-nums">
                    {"\u20B9"}{claim.amount}
                  </span>

                  {/* Date */}
                  <span className="text-[12px] text-foreground-tertiary w-[90px] text-right">
                    {claim.date}
                  </span>

                  {/* Status */}
                  <div className="w-[110px] flex justify-end">
                    <StatusBadge type={statusBadgeType(claim.status)}>
                      {claim.status}
                    </StatusBadge>
                  </div>

                  {/* Approver */}
                  <span className="text-[12px] text-foreground-tertiary w-[100px] text-right truncate">
                    {claim.approver}
                  </span>
                </div>
                {i < filtered.length - 1 && (
                  <div className="h-px bg-divider mx-3.5" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
