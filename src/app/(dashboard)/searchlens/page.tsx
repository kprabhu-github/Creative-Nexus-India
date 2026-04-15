"use client";

import { useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit,
  Globe,
  Sparkles,
  Bot,
  Eye,
  FileText,
  ExternalLink,
  Clock,
  AlertTriangle,
  Search,
  Zap,
  Loader2,
  Radar,
} from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types for API response                                             */
/* ------------------------------------------------------------------ */

interface PromptBreakdown {
  prompt: string;
  mentioned: boolean;
  position: string;
  sentiment: string;
  citationUrl: string | null;
  searchResultCount: number;
}

interface CompetitorResult {
  name: string;
  mentionCount: number;
  promptsAppearedIn: string[];
}

interface ScanResults {
  brandName: string;
  visibilityScore: number;
  totalPromptsScanned: number;
  mentionedIn: number;
  platformBreakdown: PromptBreakdown[];
  promptGaps: string[];
  competitorComparison: CompetitorResult[];
}

/* ------------------------------------------------------------------ */
/*  Mock Data (used as defaults / fallback)                            */
/* ------------------------------------------------------------------ */

const defaultPlatformBreakdown = [
  {
    name: "ChatGPT",
    mentions: 23,
    trend: "+12%",
    trendUp: true as boolean | null,
    icon: Bot,
    color: "text-[#10A37F]",
    bgColor: "bg-[#10A37F]/10",
  },
  {
    name: "Gemini",
    mentions: 18,
    trend: "+18%",
    trendUp: true as boolean | null,
    icon: Sparkles,
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
  },
  {
    name: "Perplexity",
    mentions: 9,
    trend: "0%",
    trendUp: null as boolean | null,
    icon: Search,
    color: "text-[#20B2AA]",
    bgColor: "bg-[#20B2AA]/10",
  },
];

const defaultPromptGaps = [
  {
    id: 1,
    prompt: "Best digital marketing agency for SaaS startups in 2026",
    competitor: "WebFX",
    platform: "ChatGPT",
    frequency: "Asked 340 times/week",
  },
  {
    id: 2,
    prompt: "Top AI-powered content marketing agencies",
    competitor: "Jasper Agency",
    platform: "Gemini",
    frequency: "Asked 210 times/week",
  },
  {
    id: 3,
    prompt: "Which agency offers the best SEO + AI strategy combo",
    competitor: "Siege Media",
    platform: "Perplexity",
    frequency: "Asked 180 times/week",
  },
];

const allPlatforms = [
  {
    name: "ChatGPT",
    icon: Bot,
    mentions: 23,
    sentiment: "Positive" as const,
    trendUp: true as boolean | null,
    trendValue: "+12%",
    lastChecked: "2 min ago",
    color: "text-[#10A37F]",
    bgColor: "bg-[#10A37F]/10",
  },
  {
    name: "Gemini",
    icon: Sparkles,
    mentions: 18,
    sentiment: "Positive" as const,
    trendUp: true as boolean | null,
    trendValue: "+18%",
    lastChecked: "5 min ago",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
  },
  {
    name: "Perplexity",
    icon: Search,
    mentions: 9,
    sentiment: "Neutral" as const,
    trendUp: null as boolean | null,
    trendValue: "0%",
    lastChecked: "8 min ago",
    color: "text-[#20B2AA]",
    bgColor: "bg-[#20B2AA]/10",
  },
  {
    name: "AI Overviews",
    icon: Globe,
    mentions: 14,
    sentiment: "Positive" as const,
    trendUp: true as boolean | null,
    trendValue: "+8%",
    lastChecked: "12 min ago",
    color: "text-[#EA4335]",
    bgColor: "bg-[#EA4335]/10",
  },
  {
    name: "Copilot",
    icon: BrainCircuit,
    mentions: 6,
    sentiment: "Neutral" as const,
    trendUp: false as boolean | null,
    trendValue: "-3%",
    lastChecked: "15 min ago",
    color: "text-[#0078D4]",
    bgColor: "bg-[#0078D4]/10",
  },
  {
    name: "Claude",
    icon: Zap,
    mentions: 4,
    sentiment: "Positive" as const,
    trendUp: true as boolean | null,
    trendValue: "+25%",
    lastChecked: "20 min ago",
    color: "text-[#D97706]",
    bgColor: "bg-[#D97706]/10",
  },
];

const defaultCompetitors = [
  {
    name: "WebFX",
    score: 86,
    diff: 12,
    ahead: true,
    topPrompts: [
      "Best digital marketing agency for SaaS",
      "Top performance marketing firms",
      "Agency with best ROI tracking",
    ],
  },
  {
    name: "Jasper Agency",
    score: 71,
    diff: 3,
    ahead: false,
    topPrompts: [
      "AI content marketing agency",
      "Best agency for AI-generated content",
      "Automated marketing solutions",
    ],
  },
  {
    name: "Siege Media",
    score: 79,
    diff: 5,
    ahead: true,
    topPrompts: [
      "Best SEO content agency",
      "Agency for link building and content",
      "Top organic growth marketing firms",
    ],
  },
  {
    name: "Single Grain",
    score: 68,
    diff: 6,
    ahead: false,
    topPrompts: [
      "Best PPC agency for startups",
      "Digital marketing agency for tech companies",
      "Growth marketing agency reviews",
    ],
  },
];

const sentimentMap: Record<string, "success" | "warning" | "neutral"> = {
  Positive: "success",
  Neutral: "neutral",
  Negative: "warning",
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function SearchLensPage() {
  const [tab, setTab] = useState("Overview");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleRunScan = useCallback(async () => {
    const brandName = window.prompt("Brand name to scan:", "Creative Nexus");
    if (!brandName) return;

    const promptsInput = window.prompt(
      "Search prompts (comma-separated):",
      "best digital marketing agency in India, AI-powered marketing agency",
    );
    if (!promptsInput) return;

    const prompts = promptsInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    setScanLoading(true);
    setScanError(null);

    try {
      const response = await fetch("/api/searchlens/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          prompts,
          competitors: ["WebFX", "Siege Media"],
        }),
      });

      const json: { data?: ScanResults; error?: string } = await response.json();

      if (!response.ok || json.error) {
        throw new Error(json.error ?? `Request failed with status ${response.status}`);
      }

      if (json.data) {
        setScanResults(json.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanError(message);
    } finally {
      setScanLoading(false);
    }
  }, []);

  // Derive display values from scan results or fall back to mock data
  const visibilityScore = scanResults?.visibilityScore ?? 74;

  const displayPromptGaps = scanResults
    ? scanResults.promptGaps.map((prompt, i) => ({
        id: i + 1,
        prompt,
        competitor: "Competitor",
        platform: "AI Search",
        frequency: `Gap detected in scan`,
      }))
    : defaultPromptGaps;

  const displayCompetitors = scanResults
    ? scanResults.competitorComparison.map((comp) => {
        const score = Math.round(
          (comp.mentionCount / Math.max(scanResults.totalPromptsScanned, 1)) * 100,
        );
        return {
          name: comp.name,
          score,
          diff: Math.abs(score - visibilityScore),
          ahead: score > visibilityScore,
          topPrompts: comp.promptsAppearedIn.slice(0, 3),
        };
      })
    : defaultCompetitors;

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">
            AI Visibility
          </h1>
          <p className="text-[13px] text-foreground-tertiary mt-0.5">
            Track your brand across AI search platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunScan}
            disabled={scanLoading}
            className="bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            size="sm"
          >
            {scanLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Radar className="w-3.5 h-3.5" data-icon="inline-start" />
            )}
            {scanLoading ? "Scanning..." : "Run Scan"}
          </Button>
          <SegmentedControl
            options={["Overview", "Platforms", "Competitors"]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {/* Scan Error */}
      {scanError && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
          <span>{scanError}</span>
        </div>
      )}

      {/* Tab Content */}
      {tab === "Overview" && (
        <OverviewTab
          visibilityScore={visibilityScore}
          promptGaps={displayPromptGaps}
          scanLoading={scanLoading}
        />
      )}
      {tab === "Platforms" && <PlatformsTab />}
      {tab === "Competitors" && (
        <CompetitorsTab
          competitors={displayCompetitors}
          visibilityScore={visibilityScore}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                       */
/* ------------------------------------------------------------------ */

function OverviewTab({
  visibilityScore,
  promptGaps,
  scanLoading,
}: {
  visibilityScore: number;
  promptGaps: Array<{
    id: number;
    prompt: string;
    competitor: string;
    platform: string;
    frequency: string;
  }>;
  scanLoading: boolean;
}) {
  const dashArray = (visibilityScore / 100) * 263.9;

  return (
    <div className="space-y-4">
      {/* Visibility Score + Platform Breakdown Row */}
      <div className="grid grid-cols-4 gap-3">
        {/* Big Visibility Score Card */}
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border flex flex-col items-center justify-center text-center relative">
          {scanLoading && (
            <div className="absolute inset-0 bg-background-secondary/80 rounded-[10px] flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <span className="text-[11px] font-medium text-accent">
                  Scanning...
                </span>
              </div>
            </div>
          )}
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">
            Visibility Score
          </div>
          <div className="relative flex items-center justify-center my-2">
            <svg className="w-24 h-24" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-divider"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-accent"
                strokeDasharray={`${dashArray} 263.9`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <span className="absolute text-3xl font-bold text-foreground tracking-tight">
              {visibilityScore}
            </span>
          </div>
          <ProgressBar value={visibilityScore} color="accent" className="w-full mt-1" />
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
            <span className="text-xs font-medium text-success">
              +3 from last week
            </span>
          </div>
        </div>

        {/* Platform Breakdown Cards */}
        {defaultPlatformBreakdown.map((platform) => (
          <div
            key={platform.name}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className={`w-7 h-7 rounded-lg ${platform.bgColor} flex items-center justify-center`}
              >
                <platform.icon
                  className={`w-3.5 h-3.5 ${platform.color}`}
                  strokeWidth={2}
                />
              </div>
              <span className="text-[13px] font-medium text-foreground">
                {platform.name}
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {platform.mentions}
              <span className="text-[13px] font-normal text-foreground-tertiary ml-1">
                mentions
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {platform.trendUp === true && (
                <ArrowUpRight
                  className="w-3 h-3 text-success"
                  strokeWidth={2}
                />
              )}
              {platform.trendUp === false && (
                <ArrowDownRight
                  className="w-3 h-3 text-warning"
                  strokeWidth={2}
                />
              )}
              {platform.trendUp === null && (
                <Minus
                  className="w-3 h-3 text-foreground-tertiary"
                  strokeWidth={2}
                />
              )}
              <span
                className={`text-xs font-medium ${
                  platform.trendUp === true
                    ? "text-success"
                    : platform.trendUp === false
                      ? "text-warning"
                      : "text-foreground-tertiary"
                }`}
              >
                {platform.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Prompt Gaps Detected */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="w-4 h-4 text-warning"
              strokeWidth={1.8}
            />
            <span className="text-[13px] font-semibold text-foreground">
              Prompt Gaps Detected
            </span>
          </div>
          <span className="text-xs text-foreground-tertiary">
            {promptGaps.length} gaps where competitors appear but you don&apos;t
          </span>
        </div>
        {promptGaps.length === 0 ? (
          <div className="bg-background-secondary rounded-[10px] p-6 dark:border dark:border-border text-center">
            <span className="text-[13px] text-foreground-tertiary">
              No prompt gaps detected -- your brand appears in all scanned prompts.
            </span>
          </div>
        ) : (
          <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
            {promptGaps.map((gap, i) => (
              <div key={gap.id}>
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                    <Eye
                      className="w-3.5 h-3.5 text-warning"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground leading-snug">
                      &ldquo;{gap.prompt}&rdquo;
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-foreground-tertiary">
                        {gap.competitor} appears on {gap.platform}
                      </span>
                      <span className="text-[10px] text-foreground-tertiary/60">
                        ·
                      </span>
                      <span className="text-xs text-foreground-tertiary">
                        {gap.frequency}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <FileText className="w-3.5 h-3.5" data-icon="inline-start" />
                    Create Brief
                  </Button>
                </div>
                {i < promptGaps.length - 1 && (
                  <div className="h-px bg-divider mx-3.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Platforms Tab                                                       */
/* ------------------------------------------------------------------ */

function PlatformsTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">
          All Platforms
        </span>
        <span className="text-xs text-foreground-tertiary">
          Monitored across 6 AI engines
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_100px_100px_80px_100px] gap-3 px-3.5 py-2 border-b border-divider">
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            Platform
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">
            Mentions
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-center">
            Sentiment
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">
            Trend
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">
            Checked
          </span>
        </div>

        {/* Table Rows */}
        {allPlatforms.map((platform, i) => (
          <div key={platform.name}>
            <div className="grid grid-cols-[1fr_100px_100px_80px_100px] gap-3 px-3.5 py-2.5 items-center">
              {/* Platform Name + Icon */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg ${platform.bgColor} flex items-center justify-center shrink-0`}
                >
                  <platform.icon
                    className={`w-3.5 h-3.5 ${platform.color}`}
                    strokeWidth={2}
                  />
                </div>
                <span className="text-[13px] font-medium text-foreground">
                  {platform.name}
                </span>
              </div>

              {/* Mentions */}
              <div className="text-right">
                <span className="text-[13px] font-semibold text-foreground">
                  {platform.mentions}
                </span>
              </div>

              {/* Sentiment */}
              <div className="flex justify-center">
                <StatusBadge type={sentimentMap[platform.sentiment]}>
                  {platform.sentiment}
                </StatusBadge>
              </div>

              {/* Trend */}
              <div className="flex items-center justify-end gap-1">
                {platform.trendUp === true && (
                  <TrendingUp
                    className="w-3 h-3 text-success"
                    strokeWidth={2}
                  />
                )}
                {platform.trendUp === false && (
                  <TrendingDown
                    className="w-3 h-3 text-warning"
                    strokeWidth={2}
                  />
                )}
                {platform.trendUp === null && (
                  <Minus
                    className="w-3 h-3 text-foreground-tertiary"
                    strokeWidth={2}
                  />
                )}
                <span
                  className={`text-xs font-medium ${
                    platform.trendUp === true
                      ? "text-success"
                      : platform.trendUp === false
                        ? "text-warning"
                        : "text-foreground-tertiary"
                  }`}
                >
                  {platform.trendValue}
                </span>
              </div>

              {/* Last Checked */}
              <div className="flex items-center justify-end gap-1 text-right">
                <Clock
                  className="w-3 h-3 text-foreground-tertiary"
                  strokeWidth={2}
                />
                <span className="text-xs text-foreground-tertiary">
                  {platform.lastChecked}
                </span>
              </div>
            </div>
            {i < allPlatforms.length - 1 && (
              <div className="h-px bg-divider mx-3.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Competitors Tab                                                    */
/* ------------------------------------------------------------------ */

function CompetitorsTab({
  competitors,
  visibilityScore,
}: {
  competitors: Array<{
    name: string;
    score: number;
    diff: number;
    ahead: boolean;
    topPrompts: string[];
  }>;
  visibilityScore: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">
          Competitor Visibility
        </span>
        <span className="text-xs text-foreground-tertiary">
          Your score: {visibilityScore} / 100
        </span>
      </div>
      {competitors.length === 0 ? (
        <div className="bg-background-secondary rounded-[10px] p-6 dark:border dark:border-border text-center">
          <span className="text-[13px] text-foreground-tertiary">
            No competitor data available. Run a scan to detect competitors.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {competitors.map((comp) => (
            <div
              key={comp.name}
              className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border"
            >
              {/* Competitor Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 dark:bg-foreground/10">
                    <span className="text-xs font-bold text-foreground-secondary">
                      {comp.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">
                      {comp.name}
                    </div>
                    <div className="flex items-center gap-1">
                      {comp.ahead ? (
                        <>
                          <ArrowUpRight
                            className="w-3 h-3 text-warning"
                            strokeWidth={2}
                          />
                          <span className="text-xs font-medium text-warning">
                            Ahead by {comp.diff}
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight
                            className="w-3 h-3 text-success"
                            strokeWidth={2}
                          />
                          <span className="text-xs font-medium text-success">
                            Behind by {comp.diff}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-foreground tracking-tight">
                    {comp.score}
                  </div>
                  <div className="text-[10px] text-foreground-tertiary uppercase tracking-wider">
                    Score
                  </div>
                </div>
              </div>

              {/* Score Bar */}
              <ProgressBar
                value={comp.score}
                color={comp.ahead ? "warning" : "success"}
                className="mb-3"
              />

              {/* Top Prompts */}
              <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1.5">
                Top Prompts
              </div>
              <div className="space-y-1">
                {comp.topPrompts.map((prompt, j) => (
                  <div key={j} className="flex items-start gap-1.5">
                    <ExternalLink
                      className="w-3 h-3 text-foreground-tertiary mt-0.5 shrink-0"
                      strokeWidth={2}
                    />
                    <span className="text-xs text-foreground-secondary leading-snug">
                      {prompt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
