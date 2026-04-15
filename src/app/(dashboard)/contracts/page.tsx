"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  FileSignature,
  AlertTriangle,
  Download,
  Eye,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocType = "MSA" | "NDA" | "SOW" | "Amendment";
type ContractStatus = "Draft" | "Sent" | "Viewed" | "Signed" | "Expired";

interface Contract {
  id: string;
  client: string;
  title: string;
  docType: DocType;
  status: ContractStatus;
  value: string | null;
  createdDate: string;
  sentDate: string | null;
  signedOrExpiresDate: string;
  signedOrExpiresLabel: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const contracts: Contract[] = [
  {
    id: "c1",
    client: "Acme Corp",
    title: "MSA Annual Retainer",
    docType: "MSA",
    status: "Signed",
    value: "30,00,000",
    createdDate: "Jan 5, 2026",
    sentDate: "Jan 8, 2026",
    signedOrExpiresDate: "Jan 12, 2026",
    signedOrExpiresLabel: "Signed",
    version: "v2",
  },
  {
    id: "c2",
    client: "NovaTech Solutions",
    title: "NDA",
    docType: "NDA",
    status: "Signed",
    value: null,
    createdDate: "Feb 10, 2026",
    sentDate: "Feb 12, 2026",
    signedOrExpiresDate: "Feb 14, 2026",
    signedOrExpiresLabel: "Signed",
    version: "v1",
  },
  {
    id: "c3",
    client: "Bloom Wellness",
    title: "SOW Q2 Campaign",
    docType: "SOW",
    status: "Sent",
    value: "8,50,000",
    createdDate: "Mar 20, 2026",
    sentDate: "Mar 22, 2026",
    signedOrExpiresDate: "Apr 22, 2026",
    signedOrExpiresLabel: "Expires",
    version: "v1",
  },
  {
    id: "c4",
    client: "Meridian Finance",
    title: "MSA Enterprise",
    docType: "MSA",
    status: "Viewed",
    value: "48,00,000",
    createdDate: "Mar 28, 2026",
    sentDate: "Apr 1, 2026",
    signedOrExpiresDate: "May 1, 2026",
    signedOrExpiresLabel: "Expires",
    version: "v1",
  },
  {
    id: "c5",
    client: "UrbanEdge Realty",
    title: "Amendment",
    docType: "Amendment",
    status: "Draft",
    value: null,
    createdDate: "Apr 10, 2026",
    sentDate: null,
    signedOrExpiresDate: "May 10, 2026",
    signedOrExpiresLabel: "Expires",
    version: "v1",
  },
  {
    id: "c6",
    client: "Zenith Retail",
    title: "NDA",
    docType: "NDA",
    status: "Expired",
    value: null,
    createdDate: "Nov 5, 2025",
    sentDate: "Nov 7, 2025",
    signedOrExpiresDate: "Mar 7, 2026",
    signedOrExpiresLabel: "Expired",
    version: "v1",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const filterTabs = ["All", "Active", "Pending", "Expired"] as const;
type FilterTab = (typeof filterTabs)[number];

function statusBadgeType(status: ContractStatus) {
  switch (status) {
    case "Draft":
      return "neutral" as const;
    case "Sent":
      return "info" as const;
    case "Viewed":
      return "warning" as const;
    case "Signed":
      return "success" as const;
    case "Expired":
      return "error" as const;
  }
}

function docTypePillColor(docType: DocType): string {
  switch (docType) {
    case "MSA":
      return "bg-accent/10 text-accent";
    case "NDA":
      return "bg-success/10 text-success";
    case "SOW":
      return "bg-warning/10 text-warning";
    case "Amendment":
      return "bg-foreground-tertiary/10 text-foreground-tertiary";
  }
}

function filterContracts(list: Contract[], tab: FilterTab): Contract[] {
  switch (tab) {
    case "All":
      return list;
    case "Active":
      return list.filter((c) => c.status === "Signed" || c.status === "Viewed");
    case "Pending":
      return list.filter((c) => c.status === "Draft" || c.status === "Sent");
    case "Expired":
      return list.filter((c) => c.status === "Expired");
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
}) {
  return (
    <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} strokeWidth={2} />
        </div>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-bold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

function ContractRow({ contract }: { contract: Contract }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 bg-background dark:bg-background/40">
      {/* Doc type pill */}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${docTypePillColor(
          contract.docType
        )}`}
      >
        {contract.docType}
      </span>

      {/* Client and title */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">
          {contract.client}
        </div>
        <div className="text-[12px] text-foreground-secondary truncate mt-0.5">
          {contract.title}
        </div>
      </div>

      {/* Value */}
      {contract.value && (
        <div className="hidden sm:block shrink-0">
          <span className="text-[13px] font-semibold text-foreground">
            {"\u20B9"}{contract.value}
          </span>
        </div>
      )}

      {/* Dates */}
      <div className="hidden md:flex flex-col items-end shrink-0 gap-0.5">
        <span className="text-[11px] text-foreground-tertiary">
          Created {contract.createdDate}
        </span>
        {contract.sentDate && (
          <span className="text-[11px] text-foreground-tertiary">
            Sent {contract.sentDate}
          </span>
        )}
        <span className="text-[11px] text-foreground-tertiary">
          {contract.signedOrExpiresLabel} {contract.signedOrExpiresDate}
        </span>
      </div>

      {/* Version */}
      <span className="text-[11px] font-medium text-foreground-tertiary bg-background-secondary rounded px-1.5 py-0.5 shrink-0">
        {contract.version}
      </span>

      {/* Status badge */}
      <StatusBadge type={statusBadgeType(contract.status)}>
        {contract.status}
      </StatusBadge>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon-xs" aria-label="View contract">
          <Eye className="w-3.5 h-3.5" strokeWidth={2} />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Download contract">
          <Download className="w-3.5 h-3.5" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContractsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");

  const filteredContracts = useMemo(
    () => filterContracts(contracts, activeFilter),
    [activeFilter]
  );

  const activeCount = contracts.filter(
    (c) => c.status === "Signed" || c.status === "Viewed"
  ).length;
  const pendingCount = contracts.filter(
    (c) => c.status === "Draft" || c.status === "Sent"
  ).length;
  const expiringSoonCount = 2;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Contracts"
        description="Client agreements and documents."
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={[...filterTabs]}
              value={activeFilter}
              onChange={(v) => setActiveFilter(v as FilterTab)}
            />
            <Button>
              <Plus className="w-3.5 h-3.5" strokeWidth={2} data-icon="inline-start" />
              New Contract
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="Active Contracts"
          value={activeCount}
          icon={FileText}
          iconColor="text-accent"
        />
        <SummaryCard
          label="Pending Signature"
          value={pendingCount}
          icon={FileSignature}
          iconColor="text-warning"
        />
        <SummaryCard
          label="Expiring Soon"
          value={expiringSoonCount}
          icon={AlertTriangle}
          iconColor="text-destructive"
        />
      </div>

      {/* Contracts list */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Contracts</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          {filteredContracts.length} of {contracts.length} shown
        </span>
      </div>

      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {filteredContracts.length === 0 ? (
          <div className="px-3.5 py-8 text-center">
            <span className="text-[13px] text-foreground-tertiary">
              No contracts match the selected filter.
            </span>
          </div>
        ) : (
          filteredContracts.map((contract, i) => (
            <div key={contract.id}>
              <ContractRow contract={contract} />
              {i < filteredContracts.length - 1 && (
                <div className="h-px bg-divider mx-3.5" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
