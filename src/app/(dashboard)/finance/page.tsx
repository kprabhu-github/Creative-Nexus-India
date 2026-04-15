"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Transaction {
  id: string;
  client: string;
  description: string;
  amount: string;
  date: string;
  status: "Paid" | "Pending" | "Overdue";
}

const revenue: Transaction[] = [
  { id: "t1", client: "Acme Corp", description: "Monthly retainer — Apr 2026", amount: "+5,50,000", date: "Apr 12", status: "Paid" },
  { id: "t2", client: "NovaTech Solutions", description: "SEO campaign package", amount: "+3,20,000", date: "Apr 10", status: "Paid" },
  { id: "t3", client: "Bloom Wellness", description: "Social media management", amount: "+2,80,000", date: "Apr 8", status: "Pending" },
  { id: "t4", client: "Meridian Finance", description: "Content strategy retainer", amount: "+4,10,000", date: "Apr 5", status: "Paid" },
  { id: "t5", client: "UrbanEdge Realty", description: "Brand positioning sprint", amount: "+1,90,000", date: "Apr 3", status: "Overdue" },
];

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  status: "Approved" | "Pending" | "Rejected";
}

const expenses: Expense[] = [
  { id: "x1", category: "Software", description: "Anthropic API credits", amount: "-1,85,000", date: "Apr 11", status: "Approved" },
  { id: "x2", category: "Payroll", description: "March salary disbursement", amount: "-4,20,000", date: "Apr 1", status: "Approved" },
  { id: "x3", category: "Marketing", description: "LinkedIn Ads — Q2 campaign", amount: "-65,000", date: "Apr 9", status: "Approved" },
  { id: "x4", category: "Office", description: "Coworking space — April rent", amount: "-45,000", date: "Apr 1", status: "Approved" },
  { id: "x5", category: "Travel", description: "Client meeting — Mumbai trip", amount: "-25,000", date: "Apr 7", status: "Pending" },
];

interface GSTEntry {
  id: string;
  label: string;
  amount: string;
  rate: string;
}

const gstSummary: GSTEntry[] = [
  { id: "g1", label: "CGST Collected", amount: "2,56,500", rate: "9%" },
  { id: "g2", label: "SGST Collected", amount: "2,56,500", rate: "9%" },
  { id: "g3", label: "IGST Collected", amount: "1,42,000", rate: "18%" },
];

const gstPayable = [
  { id: "gp1", label: "Total Output GST", amount: "6,55,000" },
  { id: "gp2", label: "Input Tax Credit", amount: "1,12,000" },
  { id: "gp3", label: "Net GST Payable", amount: "5,43,000" },
];

const tabs = ["Revenue", "Expenses", "GST"] as const;
type Tab = (typeof tabs)[number];

function transactionStatusType(status: Transaction["status"]) {
  switch (status) {
    case "Paid": return "success" as const;
    case "Pending": return "warning" as const;
    case "Overdue": return "error" as const;
  }
}

function expenseStatusType(status: Expense["status"]) {
  switch (status) {
    case "Approved": return "success" as const;
    case "Pending": return "warning" as const;
    case "Rejected": return "error" as const;
  }
}

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

function RevenueTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Recent Payments</span>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {revenue.map((txn, i) => (
          <div key={txn.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-success" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{txn.client}</div>
                <div className="text-xs text-foreground-tertiary">{txn.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold text-success">{txn.amount}</div>
                <div className="text-[11px] text-foreground-tertiary">{txn.date}</div>
              </div>
              <StatusBadge type={transactionStatusType(txn.status)} className="ml-1">
                {txn.status}
              </StatusBadge>
            </div>
            {i < revenue.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpensesTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Recent Expenses</span>
        <button className="text-xs font-medium text-accent hover:underline">View All</button>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {expenses.map((exp, i) => (
          <div key={exp.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{exp.description}</span>
                  <span className="text-[11px] font-medium text-foreground-tertiary bg-foreground-tertiary/8 px-1.5 py-0.5 rounded-full">
                    {exp.category}
                  </span>
                </div>
                <div className="text-xs text-foreground-tertiary">{exp.date}</div>
              </div>
              <div className="text-[13px] font-semibold text-destructive shrink-0">{exp.amount}</div>
              <StatusBadge type={expenseStatusType(exp.status)} className="ml-1">
                {exp.status}
              </StatusBadge>
            </div>
            {i < expenses.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function GSTTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">GST Collection — April 2026</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">FY 2026-27</span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {gstSummary.map((entry, i) => (
          <div key={entry.id}>
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-background dark:bg-background/40">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Percent className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{entry.label}</div>
                <div className="text-xs text-foreground-tertiary">Rate: {entry.rate}</div>
              </div>
              <div className="text-[13px] font-semibold text-foreground shrink-0">{entry.amount}</div>
            </div>
            {i < gstSummary.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>

      {/* Net payable summary */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">Net Payable Summary</span>
        </div>
        <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
          {gstPayable.map((entry, i) => (
            <div key={entry.id}>
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-background dark:bg-background/40">
                <span className={`text-[13px] ${i === gstPayable.length - 1 ? "font-semibold text-foreground" : "font-medium text-foreground-secondary"}`}>
                  {entry.label}
                </span>
                <span className={`text-[13px] font-semibold ${i === gstPayable.length - 1 ? "text-accent" : "text-foreground"}`}>
                  {entry.amount}
                </span>
              </div>
              {i < gstPayable.length - 1 && <div className="h-px bg-divider mx-3.5" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Revenue");

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Accounts"
        description="Invoices, expenses, GST reports, and revenue analytics."
        actions={
          <SegmentedControl
            options={[...tabs]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
          />
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard title="MRR" value="28,50,000" icon={DollarSign} trend="+12.4% MoM" />
        <MetricCard title="ARR" value="3.42Cr" icon={TrendingUp} trend="+18% YoY" />
        <MetricCard title="Expenses This Month" value="8,40,000" icon={TrendingDown} description="Under budget by 8%" />
        <MetricCard title="Net Margin" value="62%" icon={Percent} trend="+4.2% vs last month" />
      </div>

      {activeTab === "Revenue" && <RevenueTab />}
      {activeTab === "Expenses" && <ExpensesTab />}
      {activeTab === "GST" && <GSTTab />}
    </div>
  );
}
