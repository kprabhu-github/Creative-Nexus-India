"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageCategory = "client" | "team";

interface MessageThread {
  id: string;
  sender: string;
  initials: string;
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  category: MessageCategory;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const threads: MessageThread[] = [
  {
    id: "m1",
    sender: "Ananya Sharma",
    initials: "AS",
    subject: "Brand brief revisions for Q3",
    preview:
      "Hi, we have updated the brand positioning section based on the competitor analysis. Could you review the tone guidelines before we finalise?",
    timestamp: "10:42 AM",
    unread: true,
    category: "client",
  },
  {
    id: "m2",
    sender: "Rohan Mehta",
    initials: "RM",
    subject: "Campaign approval needed",
    preview:
      "The social media calendar for Bloom Wellness is ready. Please approve the April batch so we can schedule the posts by end of day.",
    timestamp: "9:18 AM",
    unread: true,
    category: "team",
  },
  {
    id: "m3",
    sender: "Priya Kapoor",
    initials: "PK",
    subject: "Deliverables for NovaTech sprint",
    preview:
      "All five deliverables from the strategy sprint have been uploaded to the portal. NovaTech is expecting the presentation deck by Thursday.",
    timestamp: "Yesterday",
    unread: false,
    category: "client",
  },
  {
    id: "m4",
    sender: "Dev Patel",
    initials: "DP",
    subject: "SEO brief feedback",
    preview:
      "The keyword clusters look solid but I think we should add a competitor gap section. Let me know if you want to hop on a call.",
    timestamp: "Yesterday",
    unread: false,
    category: "team",
  },
  {
    id: "m5",
    sender: "Sarah Mitchell",
    initials: "SM",
    subject: "Acme Corp retainer renewal",
    preview:
      "Acme has confirmed they want to continue with the Full Stack Retainer for another quarter. I have drafted the updated SOW for your review.",
    timestamp: "Apr 13",
    unread: true,
    category: "client",
  },
  {
    id: "m6",
    sender: "Vikram Singh",
    initials: "VS",
    subject: "New hire onboarding checklist",
    preview:
      "I have prepared the onboarding plan for the two new content strategists joining next week. Access credentials and tool setup are ready.",
    timestamp: "Apr 12",
    unread: false,
    category: "team",
  },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const tabs = ["All", "Clients", "Team"] as const;
type Tab = (typeof tabs)[number];

function filterThreads(tab: Tab): MessageThread[] {
  switch (tab) {
    case "All":
      return threads;
    case "Clients":
      return threads.filter((t) => t.category === "client");
    case "Team":
      return threads.filter((t) => t.category === "team");
  }
}

// ---------------------------------------------------------------------------
// Thread Row
// ---------------------------------------------------------------------------

function ThreadRow({
  thread,
  isLast,
}: {
  thread: MessageThread;
  isLast: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        className="flex items-start gap-3 px-3.5 py-3 w-full text-left hover:bg-surface-hover transition-colors"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[12px] font-semibold text-accent">{thread.initials}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[13px] truncate ${
                thread.unread
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground"
              }`}
            >
              {thread.sender}
            </span>
            <span className="text-[11px] text-foreground-tertiary shrink-0">
              {thread.timestamp}
            </span>
          </div>
          <div
            className={`text-[13px] truncate mt-0.5 ${
              thread.unread
                ? "font-semibold text-foreground"
                : "text-foreground-secondary"
            }`}
          >
            {thread.subject}
          </div>
          <p className="text-[12px] text-foreground-tertiary truncate mt-0.5 leading-relaxed">
            {thread.preview}
          </p>
        </div>

        {/* Unread indicator */}
        {thread.unread && (
          <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
        )}
      </button>
      {!isLast && <div className="h-px bg-divider mx-3.5" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const filtered = filterThreads(activeTab);
  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Inbox"
        description="Client and team messages"
        actions={
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="text-[12px] font-medium text-accent">
                {unreadCount} unread
              </span>
            )}
            <SegmentedControl
              options={[...tabs]}
              value={activeTab}
              onChange={(v) => setActiveTab(v as Tab)}
            />
          </div>
        }
      />

      {/* Thread List */}
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {filtered.length === 0 ? (
          <div className="px-3.5 py-8 text-center">
            <p className="text-[13px] text-foreground-tertiary">No messages in this category.</p>
          </div>
        ) : (
          filtered.map((thread, i) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              isLast={i === filtered.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
