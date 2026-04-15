"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit,
  Globe,
  Sparkles,
  Bot,
  FileText,
  ExternalLink,
  AlertTriangle,
  Search,
  Zap,
  Loader2,
  Radar,
  Plus,
  ChevronRight,
  Shield,
  Target,
  Swords,
  Lightbulb,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

interface SearchLensSettings {
  searchlens_brand_name?: string;
  searchlens_prompts?: string[];
  searchlens_competitors?: string[];
  searchlens_platforms?: string[];
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Platform definitions with brand colours                            */
/* ------------------------------------------------------------------ */

type PlatformKey = "chatgpt" | "gemini" | "perplexity" | "ai-overviews" | "copilot" | "claude";

interface PlatformInfo {
  key: PlatformKey;
  name: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
  hex: string;
}

const PLATFORMS: PlatformInfo[] = [
  { key: "chatgpt", name: "ChatGPT", icon: Bot, color: "text-[#10A37F]", bgColor: "bg-[#10A37F]/10", hex: "#10A37F" },
  { key: "gemini", name: "Gemini", icon: Sparkles, color: "text-[#4285F4]", bgColor: "bg-[#4285F4]/10", hex: "#4285F4" },
  { key: "perplexity", name: "Perplexity", icon: Search, color: "text-[#20B2AA]", bgColor: "bg-[#20B2AA]/10", hex: "#20B2AA" },
  { key: "ai-overviews", name: "AI Overviews", icon: Globe, color: "text-[#EA4335]", bgColor: "bg-[#EA4335]/10", hex: "#EA4335" },
  { key: "copilot", name: "Copilot", icon: BrainCircuit, color: "text-[#0078D4]", bgColor: "bg-[#0078D4]/10", hex: "#0078D4" },
  { key: "claude", name: "Claude", icon: Zap, color: "text-[#D97706]", bgColor: "bg-[#D97706]/10", hex: "#D97706" },
];

/* ------------------------------------------------------------------ */
/*  Mock data — used when no scan has been run                         */
/* ------------------------------------------------------------------ */

interface MockPlatformData {
  key: PlatformKey;
  mentions: number;
  score: number;
  trend: string;
  trendUp: boolean | null;
}

const mockPlatformData: MockPlatformData[] = [
  { key: "chatgpt", mentions: 23, score: 82, trend: "+12%", trendUp: true },
  { key: "gemini", mentions: 18, score: 74, trend: "+18%", trendUp: true },
  { key: "perplexity", mentions: 9, score: 58, trend: "0%", trendUp: null },
  { key: "ai-overviews", mentions: 14, score: 68, trend: "+8%", trendUp: true },
  { key: "copilot", mentions: 6, score: 42, trend: "-3%", trendUp: false },
  { key: "claude", mentions: 4, score: 36, trend: "+25%", trendUp: true },
];

interface MockCitation {
  id: number;
  platform: PlatformKey;
  prompt: string;
  position: "prominent" | "passing" | "absent";
  context: string;
  sentiment: "positive" | "neutral" | "negative";
  authority: number;
  date: string;
}

const mockCitations: MockCitation[] = [
  { id: 1, platform: "chatgpt", prompt: "Best digital marketing agency for SaaS startups in 2026", position: "prominent", context: "Creative Nexus is frequently recommended as a top-tier agency for SaaS companies, known for their AI-driven approach...", sentiment: "positive", authority: 85, date: "2026-04-15" },
  { id: 2, platform: "gemini", prompt: "Top AI-powered content marketing agencies", position: "passing", context: "Among the agencies leveraging AI, Creative Nexus Global offers interesting solutions alongside larger players...", sentiment: "neutral", authority: 72, date: "2026-04-15" },
  { id: 3, platform: "perplexity", prompt: "Which agency offers the best SEO + AI strategy combo", position: "absent", context: "", sentiment: "negative", authority: 0, date: "2026-04-14" },
  { id: 4, platform: "ai-overviews", prompt: "Best agencies for AI search optimization", position: "prominent", context: "Creative Nexus Global stands out in the AI search optimization space with their SearchLens platform...", sentiment: "positive", authority: 90, date: "2026-04-15" },
  { id: 5, platform: "chatgpt", prompt: "Agency recommendations for B2B lead generation", position: "passing", context: "For B2B lead gen, several agencies including Creative Nexus provide AI-augmented outreach solutions...", sentiment: "positive", authority: 68, date: "2026-04-14" },
  { id: 6, platform: "copilot", prompt: "Digital marketing agencies with AI capabilities", position: "absent", context: "", sentiment: "negative", authority: 0, date: "2026-04-13" },
  { id: 7, platform: "claude", prompt: "Best agency for integrated AI marketing strategy", position: "passing", context: "Creative Nexus offers a comprehensive platform but faces competition from larger established agencies...", sentiment: "neutral", authority: 55, date: "2026-04-14" },
  { id: 8, platform: "gemini", prompt: "AI-native marketing agencies for startups", position: "prominent", context: "Creative Nexus Global is pioneering the AI-native agency model with their Command Centre platform...", sentiment: "positive", authority: 88, date: "2026-04-15" },
];

interface MockCompetitor {
  rank: number;
  name: string;
  visibilityScore: number;
  citations: number;
  shareOfVoice: number;
  recommendationRate: number;
  promptsYouMiss: string[];
}

const mockCompetitors: MockCompetitor[] = [
  { rank: 1, name: "WebFX", visibilityScore: 86, citations: 42, shareOfVoice: 28.5, recommendationRate: 45, promptsYouMiss: ["Best digital marketing agency for SaaS startups", "Top performance marketing firms", "Agency with best ROI tracking"] },
  { rank: 2, name: "Siege Media", visibilityScore: 79, citations: 35, shareOfVoice: 22.0, recommendationRate: 38, promptsYouMiss: ["Best SEO content agency", "Agency for link building and content", "Top organic growth marketing firms"] },
  { rank: 3, name: "Creative Nexus", visibilityScore: 74, citations: 23, shareOfVoice: 18.5, recommendationRate: 34, promptsYouMiss: [] },
  { rank: 4, name: "Jasper Agency", visibilityScore: 71, citations: 28, shareOfVoice: 16.0, recommendationRate: 30, promptsYouMiss: ["AI content marketing agency", "Best agency for AI-generated content"] },
  { rank: 5, name: "Single Grain", visibilityScore: 68, citations: 20, shareOfVoice: 15.0, recommendationRate: 26, promptsYouMiss: ["Best PPC agency for startups", "Growth marketing agency reviews"] },
];

interface MockPromptEntry {
  id: number;
  prompt: string;
  score: number;
  platforms: Record<PlatformKey, boolean>;
  competitorCount: number;
  lastChecked: string;
  trendData: number[];
}

const mockPrompts: MockPromptEntry[] = [
  { id: 1, prompt: "Best digital marketing agency for SaaS startups in 2026", score: 82, platforms: { chatgpt: true, gemini: true, perplexity: false, "ai-overviews": true, copilot: false, claude: false }, competitorCount: 4, lastChecked: "2026-04-15", trendData: [60, 65, 70, 72, 78, 80, 82] },
  { id: 2, prompt: "Top AI-powered content marketing agencies", score: 68, platforms: { chatgpt: true, gemini: true, perplexity: true, "ai-overviews": false, copilot: false, claude: true }, competitorCount: 5, lastChecked: "2026-04-15", trendData: [55, 58, 60, 62, 65, 66, 68] },
  { id: 3, prompt: "Which agency offers the best SEO + AI strategy combo", score: 45, platforms: { chatgpt: false, gemini: true, perplexity: false, "ai-overviews": true, copilot: false, claude: false }, competitorCount: 6, lastChecked: "2026-04-14", trendData: [30, 35, 38, 40, 42, 44, 45] },
  { id: 4, prompt: "Best agencies for AI search optimization", score: 90, platforms: { chatgpt: true, gemini: true, perplexity: true, "ai-overviews": true, copilot: true, claude: true }, competitorCount: 3, lastChecked: "2026-04-15", trendData: [75, 78, 82, 85, 87, 89, 90] },
  { id: 5, prompt: "Agency recommendations for B2B lead generation", score: 55, platforms: { chatgpt: true, gemini: false, perplexity: false, "ai-overviews": true, copilot: false, claude: false }, competitorCount: 7, lastChecked: "2026-04-14", trendData: [40, 42, 45, 48, 50, 53, 55] },
  { id: 6, prompt: "AI-native marketing agencies for startups", score: 76, platforms: { chatgpt: true, gemini: true, perplexity: true, "ai-overviews": false, copilot: false, claude: true }, competitorCount: 4, lastChecked: "2026-04-15", trendData: [50, 55, 60, 65, 70, 73, 76] },
];

interface MockInsight {
  id: number;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  category: "Content" | "Technical" | "Authority" | "Competitive";
  targetModule: string;
}

const mockInsights: MockInsight[] = [
  { id: 1, priority: "critical", title: "Missing from Copilot entirely", description: "Your brand has zero presence in Microsoft Copilot search results. Copilot is growing 40% month-over-month and represents a significant visibility gap.", action: "Create Copilot-optimized content and submit to Bing Webmaster Tools", category: "Technical", targetModule: "/nexus-flow" },
  { id: 2, priority: "high", title: "Low citation authority in Perplexity", description: "While mentioned in Perplexity, your citations lack authoritative sources. Improve backlink profile from .edu and .gov domains.", action: "Launch authority-building outreach campaign targeting educational institutions", category: "Authority", targetModule: "/nexus-flow" },
  { id: 3, priority: "high", title: "Competitor WebFX dominates SaaS prompts", description: "WebFX appears in 85% of SaaS-related prompts where you are absent. Their content strategy focuses on detailed case studies and ROI metrics.", action: "Create 5 detailed SaaS case studies with measurable ROI data", category: "Competitive", targetModule: "/gtm" },
  { id: 4, priority: "medium", title: "Sentiment gap in Claude responses", description: "Claude mentions your brand but with neutral sentiment. The AI cites your services without strong endorsement language.", action: "Improve brand messaging and testimonial visibility across owned media", category: "Content", targetModule: "/social" },
  { id: 5, priority: "medium", title: "Prompt gap in B2B lead generation category", description: "7 competitors appear in B2B lead gen prompts where you are absent. This category has high commercial intent.", action: "Publish comprehensive B2B lead generation guide and case studies", category: "Content", targetModule: "/gtm" },
  { id: 6, priority: "low", title: "Optimize structured data for AI crawlers", description: "Your website lacks JSON-LD structured data that AI search engines use to extract brand information.", action: "Implement Organization, Service, and FAQ schema markup", category: "Technical", targetModule: "/projects" },
];

const mockPromptGaps = [
  { id: 1, prompt: "Best digital marketing agency for SaaS startups in 2026", competitors: ["WebFX", "Single Grain", "Directive"], platform: "ChatGPT" },
  { id: 2, prompt: "Top AI-powered content marketing agencies", competitors: ["Jasper Agency", "Copy.ai Agency"], platform: "Gemini" },
  { id: 3, prompt: "Which agency offers the best SEO + AI strategy combo", competitors: ["Siege Media", "Victorious", "Straight North"], platform: "Perplexity" },
  { id: 4, prompt: "Best PPC agency for startups 2026", competitors: ["Single Grain", "Disruptive Advertising"], platform: "Copilot" },
];

/* ------------------------------------------------------------------ */
/*  SVG ring chart helper                                              */
/* ------------------------------------------------------------------ */

function ScoreRing({ score, size = 80, strokeWidth = 6, className }: { score: number; size?: number; strokeWidth?: number; className?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashArray = (score / 100) * circumference;
  const center = size / 2;

  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-foreground/10"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-accent"
        strokeDasharray={`${dashArray} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dasharray 0.8s ease-out" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini sparkline SVG                                                 */
/* ------------------------------------------------------------------ */

function Sparkline({ data, width = 60, height = 20, className }: { data: number[]; width?: number; height?: number; className?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Trend indicator                                                    */
/* ------------------------------------------------------------------ */

function TrendIndicator({ value, trendUp }: { value: string; trendUp: boolean | null }) {
  if (trendUp === true) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success">
        <ArrowUpRight className="w-3 h-3" strokeWidth={2} />
        {value}
      </span>
    );
  }
  if (trendUp === false) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-warning">
        <ArrowDownRight className="w-3 h-3" strokeWidth={2} />
        {value}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground-tertiary">
      <Minus className="w-3 h-3" strokeWidth={2} />
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function SearchLensPage() {
  const [tab, setTab] = useState("Overview");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SearchLensSettings | null>(null);
  const [, setSettingsLoaded] = useState(false);

  // Load settings and latest scan on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const json = (await res.json()) as { data: SearchLensSettings };
          setSettings(json.data ?? null);
        }
      } catch {
        // settings load failed — use fallbacks
      }
      setSettingsLoaded(true);

      // Try to load latest scan from history
      try {
        const historyRes = await fetch("/api/searchlens/history?limit=1");
        if (historyRes.ok) {
          const historyJson = (await historyRes.json()) as { data?: ScanResults };
          if (historyJson.data) {
            setScanResults(historyJson.data);
          }
        }
      } catch {
        // history not available — use mock data
      }
    }
    void loadInitialData();
  }, []);

  const handleRunScan = useCallback(async () => {
    let brandName = settings?.searchlens_brand_name ?? "";
    if (!brandName) {
      const prompted = window.prompt("Brand name to scan:", "Creative Nexus");
      if (!prompted) return;
      brandName = prompted;
    }

    let prompts = settings?.searchlens_prompts ?? [];
    if (prompts.length === 0) {
      const promptsInput = window.prompt(
        "Search prompts (comma-separated):",
        "best digital marketing agency in India, AI-powered marketing agency, best agency for AI search optimization",
      );
      if (!promptsInput) return;
      prompts = promptsInput.split(",").map((p) => p.trim()).filter(Boolean);
    }

    const competitors = settings?.searchlens_competitors ?? ["WebFX", "Siege Media", "Jasper Agency", "Single Grain"];
    const platforms = settings?.searchlens_platforms ?? ["chatgpt", "gemini", "perplexity", "ai-overviews", "copilot", "claude"];

    setScanLoading(true);
    setScanError(null);
    setScanProgress(`Scanning 6 AI platforms across ${prompts.length} prompts...`);

    try {
      const response = await fetch("/api/searchlens/scan-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, prompts, competitors, platforms }),
      });

      // Fall back to basic scan endpoint if scan-pro is not available
      if (response.status === 404) {
        setScanProgress("Using standard scan engine...");
        const fallbackResponse = await fetch("/api/searchlens/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandName, prompts, competitors }),
        });
        const fallbackJson: { data?: ScanResults; error?: string } = await fallbackResponse.json();
        if (!fallbackResponse.ok || fallbackJson.error) {
          throw new Error(fallbackJson.error ?? `Request failed with status ${fallbackResponse.status}`);
        }
        if (fallbackJson.data) setScanResults(fallbackJson.data);
        return;
      }

      const json: { data?: ScanResults; error?: string } = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error ?? `Request failed with status ${response.status}`);
      }
      if (json.data) setScanResults(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanError(message);
    } finally {
      setScanLoading(false);
      setScanProgress("");
    }
  }, [settings]);

  // Derived display data — real scan or mock fallback
  const visibilityScore = scanResults?.visibilityScore ?? 74;
  const citationsFound = scanResults?.mentionedIn ?? 23;
  const shareOfVoice = 18.5;
  const recommendationRate = 34;
  const citationAuthority = 65;

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
            options={["Overview", "Citations", "Competitors", "Prompts", "Insights"]}
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

      {/* Scanning Banner */}
      {scanLoading && (
        <ScanningBanner
          message={scanProgress}
          promptCount={settings?.searchlens_prompts?.length ?? 6}
        />
      )}

      {/* Tab Content */}
      {tab === "Overview" && (
        <OverviewTab
          visibilityScore={visibilityScore}
          citationsFound={citationsFound}
          shareOfVoice={shareOfVoice}
          recommendationRate={recommendationRate}
          citationAuthority={citationAuthority}
          platformData={mockPlatformData}
          promptGaps={scanResults
            ? scanResults.promptGaps.map((p, i) => ({ id: i + 1, prompt: p, competitors: ["Competitor"], platform: "AI Search" }))
            : mockPromptGaps
          }
          scanLoading={scanLoading}
        />
      )}
      {tab === "Citations" && (
        <CitationsTab citations={mockCitations} />
      )}
      {tab === "Competitors" && (
        <CompetitorsTab
          competitors={scanResults
            ? scanResults.competitorComparison.map((c, i) => {
                const score = Math.round((c.mentionCount / Math.max(scanResults.totalPromptsScanned, 1)) * 100);
                return {
                  rank: i + 1,
                  name: c.name,
                  visibilityScore: score,
                  citations: c.mentionCount,
                  shareOfVoice: Math.round((c.mentionCount / Math.max(scanResults.totalPromptsScanned, 1)) * 100 * 10) / 10,
                  recommendationRate: Math.round(score * 0.45),
                  promptsYouMiss: c.promptsAppearedIn.slice(0, 3),
                };
              })
            : mockCompetitors
          }
          yourBrand="Creative Nexus"
        />
      )}
      {tab === "Prompts" && (
        <PromptsTab prompts={mockPrompts} />
      )}
      {tab === "Insights" && (
        <InsightsTab insights={mockInsights} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scanning Banner                                                    */
/* ------------------------------------------------------------------ */

function ScanningBanner({ message, promptCount }: { message: string; promptCount: number }) {
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    const timeInterval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      clearInterval(dotInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const estimatedTotal = promptCount * 10;
  const progressPct = Math.min(95, (elapsed / estimatedTotal) * 100);

  return (
    <div className="mb-4 rounded-[10px] bg-foreground text-background p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span className="text-[13px] font-medium">
            {message}{dots}
          </span>
        </div>
        <span className="text-xs text-background/60">
          ~{Math.max(0, estimatedTotal - elapsed)}s remaining
        </span>
      </div>
      <div className="h-1.5 bg-background/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 1: Overview                                                    */
/* ------------------------------------------------------------------ */

interface OverviewTabProps {
  visibilityScore: number;
  citationsFound: number;
  shareOfVoice: number;
  recommendationRate: number;
  citationAuthority: number;
  platformData: MockPlatformData[];
  promptGaps: Array<{ id: number; prompt: string; competitors: string[]; platform: string }>;
  scanLoading: boolean;
}

function OverviewTab({
  visibilityScore,
  citationsFound,
  shareOfVoice,
  recommendationRate,
  citationAuthority,
  platformData,
  promptGaps,
  scanLoading,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Hero Metrics Row — dark cards like DareAISearch */}
      {!scanLoading && (
        <div className="grid grid-cols-5 gap-3">
          {/* Visibility Score */}
          <div className="bg-foreground text-background rounded-[10px] p-4 relative">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Visibility Score
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <ScoreRing score={visibilityScore} size={64} strokeWidth={5} />
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-tight text-background">
                  {visibilityScore}
                </span>
              </div>
              <div>
                <div className="text-[11px] text-background/40">/100</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
                  <span className="text-xs font-medium text-success">+3 from last scan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Citations Found */}
          <div className="bg-foreground text-background rounded-[10px] p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Citations Found
            </div>
            <div className="text-3xl font-bold tracking-tight">{citationsFound}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
              <span className="text-xs font-medium text-success">+5 this week</span>
            </div>
          </div>

          {/* Share of Voice */}
          <div className="bg-foreground text-background rounded-[10px] p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Share of Voice
            </div>
            <div className="text-3xl font-bold tracking-tight">{shareOfVoice}%</div>
            <div className="mt-2 h-1 bg-background/10 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${shareOfVoice}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-background/40">You</span>
              <span className="text-[10px] text-background/40">WebFX: 28.5%</span>
            </div>
          </div>

          {/* Recommendation Rate */}
          <div className="bg-foreground text-background rounded-[10px] p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Recommendation Rate
            </div>
            <div className="text-3xl font-bold tracking-tight">{recommendationRate}%</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
              <span className="text-xs font-medium text-success">+2% vs last scan</span>
            </div>
          </div>

          {/* Citation Authority */}
          <div className="bg-foreground text-background rounded-[10px] p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Citation Authority
            </div>
            <div className="text-3xl font-bold tracking-tight">{citationAuthority}<span className="text-lg text-background/40">/100</span></div>
            <div className="mt-2">
              <ProgressBar value={citationAuthority} color="accent" />
            </div>
          </div>
        </div>
      )}

      {/* Platform Breakdown Row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">Platform Breakdown</span>
          <span className="text-xs text-foreground-tertiary">6 AI platforms monitored</span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {platformData.map((pData) => {
            const platformInfo = PLATFORMS.find((p) => p.key === pData.key);
            if (!platformInfo) return null;
            const Icon = platformInfo.icon;
            return (
              <div key={pData.key} className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg ${platformInfo.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${platformInfo.color}`} strokeWidth={2} />
                  </div>
                  <span className="text-[12px] font-medium text-foreground truncate">{platformInfo.name}</span>
                </div>
                <div className="text-lg font-bold text-foreground tracking-tight">
                  {pData.mentions}
                  <span className="text-[11px] font-normal text-foreground-tertiary ml-1">mentions</span>
                </div>
                <ProgressBar value={pData.score} color="accent" className="my-2" />
                <TrendIndicator value={pData.trend} trendUp={pData.trendUp} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt Gaps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.8} />
            <span className="text-[13px] font-semibold text-foreground">Prompt Gaps Detected</span>
          </div>
          <span className="text-xs text-foreground-tertiary">{promptGaps.length} gaps where competitors appear but you don&apos;t</span>
        </div>
        {promptGaps.length === 0 ? (
          <div className="bg-background-secondary rounded-[10px] p-6 dark:border dark:border-border text-center">
            <span className="text-[13px] text-foreground-tertiary">No prompt gaps detected -- your brand appears in all scanned prompts.</span>
          </div>
        ) : (
          <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
            {promptGaps.map((gap, i) => (
              <div key={gap.id}>
                <div className="flex items-center gap-3 px-3.5 py-3 border-l-2 border-l-destructive">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground leading-snug">
                      &ldquo;{gap.prompt}&rdquo;
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-foreground-tertiary">Competitors appearing:</span>
                      {gap.competitors.map((comp) => (
                        <span key={comp} className="text-xs font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <FileText className="w-3.5 h-3.5" data-icon="inline-start" />
                    Create Brief
                  </Button>
                </div>
                {i < promptGaps.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sentiment Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">Sentiment Breakdown</span>
        </div>
        <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border space-y-3">
          <SentimentBar label="Positive" value={62} color="bg-success" />
          <SentimentBar label="Neutral" value={28} color="bg-foreground-tertiary" />
          <SentimentBar label="Negative" value={10} color="bg-destructive" />
        </div>
      </div>
    </div>
  );
}

function SentimentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] font-medium text-foreground-secondary w-16">{label}</span>
      <div className="flex-1 h-2 bg-divider rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-foreground w-10 text-right">{value}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 2: Citations                                                   */
/* ------------------------------------------------------------------ */

const positionLabels: Record<string, { label: string; type: "success" | "warning" | "error" }> = {
  prominent: { label: "Prominent", type: "success" },
  passing: { label: "Passing", type: "warning" },
  absent: { label: "Absent", type: "error" },
};

const sentimentLabels: Record<string, { label: string; type: "success" | "warning" | "neutral" }> = {
  positive: { label: "Positive", type: "success" },
  neutral: { label: "Neutral", type: "neutral" },
  negative: { label: "Negative", type: "warning" },
};

function CitationsTab({ citations }: { citations: MockCitation[] }) {
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterSentiment, setFilterSentiment] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "authority" | "platform">("date");

  const filtered = useMemo(() => {
    let result = [...citations];
    if (filterPlatform !== "all") result = result.filter((c) => c.platform === filterPlatform);
    if (filterSentiment !== "all") result = result.filter((c) => c.sentiment === filterSentiment);
    if (filterPosition !== "all") result = result.filter((c) => c.position === filterPosition);

    result.sort((a, b) => {
      if (sortBy === "date") return b.date.localeCompare(a.date);
      if (sortBy === "authority") return b.authority - a.authority;
      return a.platform.localeCompare(b.platform);
    });

    return result;
  }, [citations, filterPlatform, filterSentiment, filterPosition, sortBy]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
          <span className="text-xs font-medium text-foreground-tertiary">Filter:</span>
        </div>
        <select
          className="text-xs bg-background-secondary text-foreground border border-divider rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>
        <select
          className="text-xs bg-background-secondary text-foreground border border-divider rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
          value={filterSentiment}
          onChange={(e) => setFilterSentiment(e.target.value)}
        >
          <option value="all">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <select
          className="text-xs bg-background-secondary text-foreground border border-divider rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value)}
        >
          <option value="all">All Positions</option>
          <option value="prominent">Prominent</option>
          <option value="passing">Passing</option>
          <option value="absent">Absent</option>
        </select>
        <div className="flex items-center gap-1 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-foreground-tertiary" strokeWidth={2} />
          <select
            className="text-xs bg-background-secondary text-foreground border border-divider rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-accent"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "authority" | "platform")}
          >
            <option value="date">Sort by Date</option>
            <option value="authority">Sort by Authority</option>
            <option value="platform">Sort by Platform</option>
          </select>
        </div>
      </div>

      {/* Citations Table */}
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_90px_1fr_90px_70px_80px] gap-3 px-3.5 py-2 border-b border-divider">
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
            {/* Platform icon */}
          </span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Prompt</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-center">Position</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Context</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-center">Sentiment</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">Authority</span>
          <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">Date</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-3.5 py-8 text-center text-[13px] text-foreground-tertiary">
            No citations match the selected filters.
          </div>
        ) : (
          filtered.map((citation, i) => {
            const platformInfo = PLATFORMS.find((p) => p.key === citation.platform);
            if (!platformInfo) return null;
            const Icon = platformInfo.icon;
            const posInfo = positionLabels[citation.position];
            const sentInfo = sentimentLabels[citation.sentiment];

            return (
              <div key={citation.id}>
                <div className="grid grid-cols-[40px_1fr_90px_1fr_90px_70px_80px] gap-3 px-3.5 py-2.5 items-center">
                  <div className={`w-7 h-7 rounded-lg ${platformInfo.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${platformInfo.color}`} strokeWidth={2} />
                  </div>
                  <div className="text-[12px] text-foreground truncate" title={citation.prompt}>
                    {citation.prompt}
                  </div>
                  <div className="flex justify-center">
                    <StatusBadge type={posInfo.type}>{posInfo.label}</StatusBadge>
                  </div>
                  <div className="text-[11px] text-foreground-secondary truncate" title={citation.context}>
                    {citation.context || <span className="text-foreground-tertiary italic">Not found in results</span>}
                  </div>
                  <div className="flex justify-center">
                    <StatusBadge type={sentInfo.type}>{sentInfo.label}</StatusBadge>
                  </div>
                  <div className="text-right text-[12px] font-semibold text-foreground">
                    {citation.authority > 0 ? citation.authority : "--"}
                  </div>
                  <div className="text-right text-[11px] text-foreground-tertiary">
                    {citation.date}
                  </div>
                </div>
                {i < filtered.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3: Competitors                                                 */
/* ------------------------------------------------------------------ */

function CompetitorsTab({ competitors, yourBrand }: { competitors: MockCompetitor[]; yourBrand: string }) {
  return (
    <div className="space-y-4">
      {/* Leaderboard Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">AI Visibility Leaderboard</span>
          <span className="text-xs text-foreground-tertiary">{competitors.length} brands tracked</span>
        </div>
        <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border">
          {/* Header */}
          <div className="grid grid-cols-[50px_1fr_100px_80px_100px_120px] gap-3 px-3.5 py-2 border-b border-divider">
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-center">Rank</span>
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">Brand</span>
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">Visibility</span>
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">Citations</span>
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">Share of Voice</span>
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider text-right">Rec. Rate</span>
          </div>

          {competitors.map((comp, i) => {
            const isYou = comp.name === yourBrand;
            return (
              <div key={comp.name}>
                <div className={`grid grid-cols-[50px_1fr_100px_80px_100px_120px] gap-3 px-3.5 py-2.5 items-center ${isYou ? "bg-accent/5" : ""}`}>
                  <div className="flex justify-center">
                    {comp.rank <= 3 ? (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        comp.rank === 1 ? "bg-yellow-400/20 text-yellow-600" :
                        comp.rank === 2 ? "bg-gray-300/20 text-gray-500" :
                        "bg-orange-300/20 text-orange-500"
                      }`}>
                        {comp.rank}
                      </div>
                    ) : (
                      <span className="text-[13px] text-foreground-tertiary">{comp.rank}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isYou ? "bg-accent/10" : "bg-foreground/5 dark:bg-foreground/10"}`}>
                      <span className={`text-[10px] font-bold ${isYou ? "text-accent" : "text-foreground-secondary"}`}>
                        {comp.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[13px] font-medium ${isYou ? "text-accent" : "text-foreground"}`}>
                        {comp.name}
                        {isYou && <span className="text-[10px] ml-1 text-accent/60">(You)</span>}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-bold text-foreground">{comp.visibilityScore}</span>
                    <span className="text-[11px] text-foreground-tertiary">/100</span>
                  </div>
                  <div className="text-right text-[13px] font-semibold text-foreground">{comp.citations}</div>
                  <div className="text-right text-[13px] font-semibold text-foreground">{comp.shareOfVoice}%</div>
                  <div className="text-right text-[13px] font-semibold text-foreground">{comp.recommendationRate}%</div>
                </div>
                {i < competitors.length - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Competitor Detail Cards — prompts they appear in that you don't */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">Competitor Prompt Coverage</span>
          <span className="text-xs text-foreground-tertiary">Prompts where they appear and you don&apos;t</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {competitors
            .filter((c) => c.name !== yourBrand && c.promptsYouMiss.length > 0)
            .map((comp) => (
              <div key={comp.name} className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-foreground/5 dark:bg-foreground/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-foreground-secondary">
                        {comp.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">{comp.name}</div>
                      <div className="text-xs text-foreground-tertiary">Score: {comp.visibilityScore}/100</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = "/nexus-flow"}>
                    <Swords className="w-3.5 h-3.5" data-icon="inline-start" />
                    Attack
                  </Button>
                </div>

                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1.5">
                  Prompts you&apos;re missing
                </div>
                <div className="space-y-1.5">
                  {comp.promptsYouMiss.map((prompt, j) => (
                    <div key={j} className="flex items-start gap-1.5">
                      <ExternalLink className="w-3 h-3 text-warning mt-0.5 shrink-0" strokeWidth={2} />
                      <span className="text-xs text-foreground-secondary leading-snug">{prompt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 4: Prompts                                                     */
/* ------------------------------------------------------------------ */

function PromptsTab({ prompts }: { prompts: MockPromptEntry[] }) {
  const [showAddPrompt, setShowAddPrompt] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-semibold text-foreground">Monitored Prompts</span>
        <Button variant="outline" size="sm" onClick={() => setShowAddPrompt(!showAddPrompt)}>
          <Plus className="w-3.5 h-3.5" data-icon="inline-start" />
          Add Prompt
        </Button>
      </div>

      {showAddPrompt && (
        <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border flex items-center gap-2">
          <input
            type="text"
            placeholder="Enter a search prompt to monitor..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-foreground-tertiary outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") setShowAddPrompt(false);
            }}
          />
          <Button size="sm" className="bg-accent text-white hover:bg-accent/90" onClick={() => setShowAddPrompt(false)}>
            Add
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {prompts.map((entry) => {
          return (
            <div key={entry.id} className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-[13px] font-medium text-foreground leading-snug">{entry.prompt}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-foreground-tertiary">{entry.competitorCount} competitors</span>
                    <span className="text-[10px] text-foreground-tertiary/50">|</span>
                    <span className="text-xs text-foreground-tertiary">Last checked {entry.lastChecked}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Sparkline data={entry.trendData} width={50} height={16} />
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground tracking-tight">{entry.score}</div>
                    <div className="text-[10px] text-foreground-tertiary uppercase">Score</div>
                  </div>
                </div>
              </div>

              {/* Platform dots */}
              <div className="flex items-center gap-1.5 mt-2">
                {PLATFORMS.map((platform) => {
                  const isPresent = entry.platforms[platform.key];
                  return (
                    <div
                      key={platform.key}
                      className="flex items-center gap-1"
                      title={`${platform.name}: ${isPresent ? "Mentioned" : "Not found"}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isPresent ? `bg-[${platform.hex}]` : "bg-foreground-tertiary/20"}`}
                        style={isPresent ? { backgroundColor: platform.hex } : undefined}
                      />
                      <span className={`text-[10px] ${isPresent ? "text-foreground-secondary" : "text-foreground-tertiary/50"}`}>
                        {platform.name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 5: Insights                                                    */
/* ------------------------------------------------------------------ */

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-destructive/10", text: "text-destructive", label: "Critical" },
  high: { bg: "bg-warning/10", text: "text-warning", label: "High" },
  medium: { bg: "bg-accent/10", text: "text-accent", label: "Medium" },
  low: { bg: "bg-foreground-tertiary/10", text: "text-foreground-tertiary", label: "Low" },
};

const categoryIcons: Record<string, typeof Lightbulb> = {
  Content: FileText,
  Technical: BrainCircuit,
  Authority: Shield,
  Competitive: Swords,
};

function InsightsTab({ insights }: { insights: MockInsight[] }) {
  const sorted = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...insights].sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4));
  }, [insights]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-accent" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold text-foreground">AI-Generated Recommendations</span>
        </div>
        <span className="text-xs text-foreground-tertiary">{insights.length} insights from latest scan</span>
      </div>

      <div className="space-y-2">
        {sorted.map((insight) => {
          const pStyle = priorityStyles[insight.priority];
          const CategoryIcon = categoryIcons[insight.category] ?? Lightbulb;

          return (
            <div key={insight.id} className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${pStyle.bg} ${pStyle.text}`}>
                    {pStyle.label}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-foreground/5 text-foreground-secondary dark:bg-foreground/10">
                    <CategoryIcon className="w-3 h-3" strokeWidth={2} />
                    {insight.category}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = insight.targetModule}
                >
                  <ChevronRight className="w-3.5 h-3.5" data-icon="inline-start" />
                  Execute
                </Button>
              </div>

              <h3 className="text-[13px] font-semibold text-foreground mb-1">{insight.title}</h3>
              <p className="text-[12px] text-foreground-secondary leading-relaxed mb-2">{insight.description}</p>

              <div className="flex items-start gap-1.5 bg-foreground/[0.03] dark:bg-foreground/[0.05] rounded-lg px-3 py-2">
                <Target className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" strokeWidth={2} />
                <span className="text-[12px] text-foreground font-medium">{insight.action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
