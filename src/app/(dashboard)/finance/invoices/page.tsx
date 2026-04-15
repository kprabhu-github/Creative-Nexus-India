import {
  Plus,
  FileText,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PenLine,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceStatus = "Paid" | "Pending" | "Overdue" | "Draft";

interface Invoice {
  id: string;
  number: string;
  client: string;
  amount: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const invoices: Invoice[] = [
  {
    id: "inv-1",
    number: "INV-2026-041",
    client: "Acme Corp",
    amount: "2,45,000",
    date: "Apr 1, 2026",
    dueDate: "Apr 30, 2026",
    status: "Paid",
  },
  {
    id: "inv-2",
    number: "INV-2026-042",
    client: "NovaTech Solutions",
    amount: "1,80,000",
    date: "Apr 3, 2026",
    dueDate: "May 3, 2026",
    status: "Pending",
  },
  {
    id: "inv-3",
    number: "INV-2026-043",
    client: "Bloom Wellness",
    amount: "95,000",
    date: "Mar 15, 2026",
    dueDate: "Apr 14, 2026",
    status: "Overdue",
  },
  {
    id: "inv-4",
    number: "INV-2026-044",
    client: "Meridian Finance",
    amount: "3,10,000",
    date: "Apr 5, 2026",
    dueDate: "May 5, 2026",
    status: "Paid",
  },
  {
    id: "inv-5",
    number: "INV-2026-045",
    client: "Priya Crafts Co.",
    amount: "1,20,000",
    date: "Apr 8, 2026",
    dueDate: "May 8, 2026",
    status: "Pending",
  },
  {
    id: "inv-6",
    number: "INV-2026-046",
    client: "Zenith Retail",
    amount: "2,75,000",
    date: "Apr 10, 2026",
    dueDate: "May 10, 2026",
    status: "Paid",
  },
  {
    id: "inv-7",
    number: "INV-2026-047",
    client: "Cloudbridge AI",
    amount: "25,000",
    date: "Mar 20, 2026",
    dueDate: "Apr 5, 2026",
    status: "Overdue",
  },
  {
    id: "inv-8",
    number: "INV-2026-048",
    client: "Summit Health",
    amount: "1,60,000",
    date: "Apr 14, 2026",
    dueDate: "May 14, 2026",
    status: "Draft",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeType(status: InvoiceStatus) {
  switch (status) {
    case "Paid":
      return "success" as const;
    case "Pending":
      return "warning" as const;
    case "Overdue":
      return "error" as const;
    case "Draft":
      return "neutral" as const;
  }
}

function StatusIcon({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case "Paid":
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={2} />;
    case "Pending":
      return <Clock className="w-3.5 h-3.5 text-warning" strokeWidth={2} />;
    case "Overdue":
      return <AlertTriangle className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />;
    case "Draft":
      return <PenLine className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />;
  }
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: string;
  icon: typeof IndianRupee;
  iconColor: string;
}) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-[7px] ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-bold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoicesPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Invoices"
        description="Create, send, and track client invoices"
        actions={
          <Button className="bg-accent text-white hover:bg-accent/90 border-transparent">
            <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
            Create Invoice
          </Button>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MetricCard
          label="Outstanding"
          value="&#8377;4,85,000"
          icon={IndianRupee}
          iconColor="bg-warning/10 text-warning"
        />
        <MetricCard
          label="Paid This Month"
          value="&#8377;12,30,000"
          icon={CheckCircle2}
          iconColor="bg-success/10 text-success"
        />
        <MetricCard
          label="Overdue"
          value="&#8377;1,20,000"
          icon={AlertTriangle}
          iconColor="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Invoice List */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">All Invoices</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {invoices.length} invoices
        </span>
      </div>

      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {/* Table Header */}
        <div className="flex items-center gap-3 px-3.5 py-2 border-b border-divider">
          <div className="w-7 shrink-0" />
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider flex-1 min-w-0 max-w-[140px]">
            Invoice
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider flex-1 min-w-0">
            Client
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[100px] text-right">
            Amount
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[100px] text-right">
            Date
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[100px] text-right">
            Due Date
          </span>
          <span className="text-[11px] font-semibold text-foreground-tertiary uppercase tracking-wider w-[90px] text-right">
            Status
          </span>
        </div>

        {/* Invoice Rows */}
        {invoices.map((invoice, i) => (
          <div key={invoice.id}>
            <div
              className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center shrink-0 dark:bg-foreground-tertiary/10">
                <StatusIcon status={invoice.status} />
              </div>
              <div className="flex-1 min-w-0 max-w-[140px]">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-foreground-tertiary shrink-0" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-foreground">{invoice.number}</span>
                </div>
              </div>
              <span className="text-[13px] text-foreground flex-1 min-w-0">{invoice.client}</span>
              <span className="text-[13px] font-semibold text-foreground w-[100px] text-right tabular-nums">
                &#8377;{invoice.amount}
              </span>
              <span className="text-[12px] text-foreground-tertiary w-[100px] text-right">
                {invoice.date}
              </span>
              <span className="text-[12px] text-foreground-tertiary w-[100px] text-right">
                {invoice.dueDate}
              </span>
              <div className="w-[90px] flex justify-end">
                <StatusBadge type={statusBadgeType(invoice.status)}>
                  {invoice.status}
                </StatusBadge>
              </div>
            </div>
            {i < invoices.length - 1 && <div className="h-px bg-divider mx-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}
