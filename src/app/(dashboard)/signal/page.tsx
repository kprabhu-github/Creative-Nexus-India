"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Zap,
  CalendarDays,
  FileText,
  Play,
  CheckCircle2,
  Loader2,
  ListOrdered,
  Download,
  Crosshair,
  PenTool,
  Mail,
  BarChart3,
  Globe,
  Shield,
  Map,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  workflow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const quickActions: QuickAction[] = [
  {
    id: "w1",
    workflow: "W1",
    title: "Run Strategy Sprint",
    description: "Full competitor analysis, brand positioning, and content strategy in one pass.",
    icon: Zap,
  },
  {
    id: "w2",
    workflow: "W2",
    title: "Generate Content Plan",
    description: "SEO-driven 90-day content calendar with topic clusters and keyword targets.",
    icon: FileText,
  },
  {
    id: "w3",
    workflow: "W3",
    title: "Social Calendar",
    description: "Platform-specific social calendar with captions, hashtags, and posting schedule.",
    icon: CalendarDays,
  },
];

interface BriefSection {
  name: string;
  icon: LucideIcon;
  items: number;
}

const brandBriefSections: BriefSection[] = [
  { name: "Brand Positioning", icon: Crosshair, items: 6 },
  { name: "Voice Rules", icon: PenTool, items: 12 },
  { name: "Content Pillars", icon: ListOrdered, items: 5 },
  { name: "Competitor Map", icon: Map, items: 8 },
];

interface Deliverable {
  id: string;
  title: string;
  type: string;
  format: "PDF" | "DOCX" | "CSV";
  date: string;
  icon: LucideIcon;
}

const deliverables: Deliverable[] = [
  { id: "d1", title: "Q2 Content Strategy", type: "Strategy", format: "PDF", date: "Apr 12, 2026", icon: BarChart3 },
  { id: "d2", title: "SEO Brief — SaaS Keywords", type: "SEO", format: "PDF", date: "Apr 10, 2026", icon: Globe },
  { id: "d3", title: "90-Day Social Calendar", type: "Social", format: "CSV", date: "Apr 9, 2026", icon: CalendarDays },
  { id: "d4", title: "Email Nurture Sequence", type: "Email", format: "DOCX", date: "Apr 7, 2026", icon: Mail },
  { id: "d5", title: "Competitor Intelligence Report", type: "Intel", format: "PDF", date: "Apr 5, 2026", icon: Shield },
  { id: "d6", title: "Brand Voice Guidelines", type: "Brand", format: "PDF", date: "Apr 3, 2026", icon: PenTool },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const tabs = ["Workflows", "Brand Brief", "Deliverables"] as const;
type Tab = (typeof tabs)[number];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WorkflowsTab({
  w7Loading,
  w7Status,
  w7Progress,
  w7Error,
  onLaunchW7,
}: {
  w7Loading: boolean;
  w7Status: string;
  w7Progress: number;
  w7Error: string | null;
  onLaunchW7: () => void;
}) {
  return (
    <div>
      {/* Quick Actions */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Quick Actions</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          8 workflows available
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((action) => {
          const isW7 = action.workflow === "W7" || action.id === "w1";

          return (
            <div
              key={action.id}
              className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0">
                    <action.icon className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                  </div>
                  <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                    {action.workflow}
                  </span>
                </div>
                <div className="text-[13px] font-semibold text-foreground leading-tight">{action.title}</div>
                <p className="text-[12px] text-foreground-tertiary mt-1 leading-relaxed">{action.description}</p>
              </div>

              {/* W7 card gets wired to real API; other cards keep the static button */}
              {isW7 ? (
                <div className="mt-3 space-y-2">
                  <Button
                    size="sm"
                    className="w-full bg-accent text-white hover:bg-accent/90 border-transparent"
                    disabled={w7Loading}
                    onClick={onLaunchW7}
                  >
                    {w7Loading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" strokeWidth={2.5} />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" strokeWidth={2.5} />
                        Launch
                      </>
                    )}
                  </Button>

                  {/* Live status line */}
                  {w7Status && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {w7Status === "completed" ? (
                          <CheckCircle2 className="w-3 h-3 text-success" strokeWidth={2} />
                        ) : w7Status === "failed" ? (
                          <AlertCircle className="w-3 h-3 text-destructive" strokeWidth={2} />
                        ) : (
                          <Loader2 className="w-3 h-3 text-accent animate-spin" strokeWidth={2} />
                        )}
                        <span
                          className={`text-[11px] font-medium ${
                            w7Status === "completed"
                              ? "text-success"
                              : w7Status === "failed"
                                ? "text-destructive"
                                : "text-accent"
                          }`}
                        >
                          {w7Status === "completed"
                            ? "Completed"
                            : w7Status === "failed"
                              ? "Failed"
                              : `Running... ${w7Progress}%`}
                        </span>
                      </div>
                      {w7Loading && <ProgressBar value={w7Progress} color="accent" />}
                    </div>
                  )}

                  {/* Error display */}
                  {w7Error && (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {w7Error}
                    </p>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  className="mt-3 w-full bg-accent text-white hover:bg-accent/90 border-transparent"
                >
                  <Play className="w-3 h-3 mr-1" strokeWidth={2.5} />
                  Launch
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent runs will be populated from Supabase when real workflow data exists */}
    </div>
  );
}

function BrandBriefTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Active Brand Brief</span>
        <button className="text-xs font-medium text-accent hover:underline">Edit Brief</button>
      </div>
      <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
        {/* Brief header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[9px] bg-accent/10 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-accent" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-foreground">Acme Corp</div>
              <div className="text-[12px] text-foreground-tertiary">B2B SaaS &middot; Series B &middot; 120 employees</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge type="success">Approved</StatusBadge>
            <span className="text-[11px] font-medium text-foreground-tertiary bg-foreground-tertiary/8 px-2 py-0.5 rounded-full">
              v2.1
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-divider my-3" />

        {/* Sections */}
        <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-2">
          Brief Sections
        </div>
        <div className="grid grid-cols-2 gap-2">
          {brandBriefSections.map((section) => (
            <div
              key={section.name}
              className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 dark:bg-background/40"
            >
              <div className="w-7 h-7 rounded-[7px] bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
                <section.icon className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{section.name}</div>
                <div className="text-[12px] text-foreground-tertiary">{section.items} items defined</div>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-divider my-3" />

        {/* Footer metadata */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-foreground-tertiary">
            Last updated Apr 11, 2026 by <span className="text-foreground font-medium">Sarah Mitchell</span>
          </span>
          <span className="text-[12px] text-foreground-tertiary">
            Quality score: <span className="text-success font-semibold">96%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function formatBadgeColor(format: Deliverable["format"]): string {
  switch (format) {
    case "PDF":
      return "bg-accent/10 text-accent";
    case "DOCX":
      return "bg-success/10 text-success";
    case "CSV":
      return "bg-warning/10 text-warning";
  }
}

function DeliverablesTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Recent Deliverables</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          6 files
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {deliverables.map((item) => (
          <div
            key={item.id}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-[7px] bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
                  <item.icon className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
                </div>
                <span className={`text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${formatBadgeColor(item.format)}`}>
                  {item.format}
                </span>
              </div>
              <div className="text-[13px] font-semibold text-foreground leading-tight">{item.title}</div>
              <div className="text-[12px] text-foreground-tertiary mt-0.5">{item.date}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              <Download className="w-3 h-3 mr-1" strokeWidth={2} />
              Download
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface AgencySettings {
  domain?: string;
  default_competitors?: string[];
  target_audience?: string;
  [key: string]: unknown;
}

export default function SignalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Workflows");
  const [settings, setSettings] = useState<AgencySettings | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const json = (await res.json()) as { data: AgencySettings };
          setSettings(json.data ?? null);
        }
      } catch {
        // Settings load failed — will fall back to window.prompt
      }
    }
    void loadSettings();
  }, []);

  // ---------------------------------------------------------------------------
  // W7 workflow state
  // ---------------------------------------------------------------------------
  const [w7Loading, setW7Loading] = useState(false);
  const [, setW7RunId] = useState<string | null>(null);
  const [w7Status, setW7Status] = useState<string>("");
  const [w7Progress, setW7Progress] = useState(0);
  const [w7Error, setW7Error] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Stop the polling interval if running. */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /** Poll /api/agents/status/:runId every 5 seconds. */
  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();

      const poll = async () => {
        try {
          const res = await fetch(`/api/agents/status/${runId}`);
          if (!res.ok) {
            const errBody = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(errBody?.error ?? `Status check failed (${res.status})`);
          }

          const json = (await res.json()) as {
            data: {
              run: { status: string; progress: number; error: string | null };
            };
          };

          const run = json.data.run;
          setW7Progress(run.progress ?? 0);

          if (run.status === "completed") {
            setW7Status("completed");
            setW7Loading(false);
            stopPolling();
          } else if (run.status === "failed") {
            setW7Status("failed");
            setW7Error(run.error ?? "Workflow failed");
            setW7Loading(false);
            stopPolling();
          } else {
            setW7Status(run.status);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Polling error";
          setW7Error(message);
          setW7Loading(false);
          stopPolling();
        }
      };

      // Poll immediately, then every 5 seconds
      void poll();
      pollIntervalRef.current = setInterval(() => {
        void poll();
      }, 5000);
    },
    [stopPolling],
  );

  /** Launch the W7 Client Onboarding workflow. */
  const launchW7 = useCallback(async () => {
    // Use settings domain as default, fall back to window.prompt
    let clientDomain = settings?.domain ?? "";
    if (!clientDomain) {
      const prompted = window.prompt("Enter client domain (e.g. acme.com):");
      if (!prompted) return;
      clientDomain = prompted;
    }

    const competitors = settings?.default_competitors ?? [];
    const targetAudience = (settings?.target_audience as string) ?? "";

    // Reset state
    setW7Loading(true);
    setW7Status("pending");
    setW7Progress(0);
    setW7Error(null);
    setW7RunId(null);

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowCode: "W7",
          clientDomain,
          competitors,
          targetAudience,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errBody?.error ?? `Failed to launch workflow (${res.status})`);
      }

      const json = (await res.json()) as { data: { runId: string } };
      const { runId } = json.data;

      setW7RunId(runId);
      startPolling(runId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to launch W7";
      setW7Error(message);
      setW7Loading(false);
      setW7Status("");
    }
  }, [startPolling, settings]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Signal Engine"
        description="AI-powered content strategy and brand intelligence workflows."
        actions={
          <SegmentedControl
            options={[...tabs]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
          />
        }
      />

      {activeTab === "Workflows" && (
        <WorkflowsTab
          w7Loading={w7Loading}
          w7Status={w7Status}
          w7Progress={w7Progress}
          w7Error={w7Error}
          onLaunchW7={launchW7}
        />
      )}
      {activeTab === "Brand Brief" && <BrandBriefTab />}
      {activeTab === "Deliverables" && <DeliverablesTab />}
    </div>
  );
}
