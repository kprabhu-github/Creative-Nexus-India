"use client";

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
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
  MessageSquare,
  MapPin,
  Video,
  Download,
  BellRing,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { GlowCard } from "./_components/GlowCard";
import { ScoreCountUp } from "./_components/ScoreCountUp";
import { ScanProgressStepper } from "./_components/ScanProgressStepper";
import { ScanSetupModal, type ScanSetupConfig } from "./_components/ScanSetupModal";
import { SearchLensHero } from "./_components/SearchLensHero";

// Stub by default; parallel agent C ships ./_components/SiteAuditTab with real impl.
const SiteAuditTab = dynamic(() => import("./_components/SiteAuditTab"), {
  ssr: false,
  loading: () => (
    <div className="rounded-[10px] border border-divider bg-background-secondary p-6 text-[13px] text-foreground-tertiary">
      Loading site audit…
    </div>
  ),
});

const TrackedPromptsTab = dynamic(() => import("./_components/TrackedPromptsTab"), {
  ssr: false,
  loading: () => <div className="text-[12px] text-foreground-tertiary">Loading tracked prompts…</div>,
});

const TAB_OPTIONS = ["Overview", "Citations", "Competitors", "Prompts", "Tracked", "Insights", "Site Audit"] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/* ScanResults is shaped to match HistoryResponse.data so the page
 * can hydrate from either /api/searchlens/history (one shot, on mount)
 * or be projected from /api/searchlens/scan-pro response (after a
 * successful scan). Field names mirror HistoryResponse.data exactly. */
type SLPlatformKey = "chatgpt" | "gemini" | "perplexity" | "ai-overviews" | "copilot" | "claude";

interface CitationEntry {
  id: string;
  platform: SLPlatformKey;
  prompt: string;
  position: "prominent" | "passing" | "absent";
  context: string;
  sentiment: "positive" | "neutral" | "negative";
  authority: number;
  sources: string[];
  date: string;
}

interface CompetitorEntry {
  name: string;
  mentionCount: number;
  promptsAppearedIn: string[];
}

interface PromptEntry {
  id: string;
  prompt: string;
  score: number;
  platforms: Record<string, boolean>;
  competitorCount: number;
  lastChecked: string;
  trendData: number[];
}

interface InsightEntry {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  category: "Content" | "Technical" | "Authority" | "Competitive";
  targetModule: string;
}

interface PlatformBreakdownEntry {
  key: string;
  mentions: number;
  score: number;
  trend: string;
  trendUp: boolean | null;
}

interface CitedDomainEntry {
  domain: string;
  mentionCount: number;
  avgAuthority: number;
  score: number;
}

interface ScanResults {
  brandName: string;
  domain: string | null;
  visibilityScore: number;
  citationCount: number;
  shareOfVoice: number;
  recommendationRate: number;
  citationAuthority: number;
  sentiment: { positive: number; neutral: number; negative: number };
  platformBreakdown: PlatformBreakdownEntry[];
  promptGaps: string[];
  competitorComparison: CompetitorEntry[];
  citations: CitationEntry[];
  insights: InsightEntry[];
  prompts: PromptEntry[];
  citedDomains: CitedDomainEntry[];
  scannedAt: string;
  // Kept for legacy stepper computations
  totalPromptsScanned: number;
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
/*  Scan-pro response normaliser                                       */
/*  scan-pro returns a richer shape than HistoryResponse.data — this   */
/*  collapses both into the same ScanResults projection.               */
/* ------------------------------------------------------------------ */

interface ScanProRawCitation {
  platform: string;
  prompt: string;
  mentioned?: boolean;
  position: "prominent" | "passing" | "absent";
  context: string | null;
  sentiment: "positive" | "neutral" | "negative";
  citationUrl?: string | null;
  authorityScore?: number;
}

interface ScanProRawInsight {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "content" | "technical" | "authority" | "competitive" | string;
  actionItem?: string;
  action?: string;
}

interface ScanProRawCompetitor {
  name: string;
  score?: number;
  mentions?: number;
  mentionCount?: number;
  promptsAppearedIn?: string[];
}

interface ScanProResponseLike {
  brandName?: string;
  domain?: string | null;
  visibilityScore: number;
  citationCount?: number;
  mentionedIn?: number;
  shareOfVoice?: number;
  recommendationRate?: number;
  citationAuthority?: number;
  sentiment?: { positive: number; neutral: number; negative: number };
  platformBreakdown?: PlatformBreakdownEntry[] | Record<string, { score: number; mentions: number; totalChecked: number }>;
  promptGaps?: string[];
  competitorComparison?: ScanProRawCompetitor[];
  citations?: ScanProRawCitation[];
  insights?: ScanProRawInsight[];
  prompts?: PromptEntry[];
  citedDomains?: CitedDomainEntry[];
  totalPromptsScanned?: number;
  scannedAt?: string;
}

const VALID_PLATFORM_KEYS: SLPlatformKey[] = [
  "chatgpt", "gemini", "perplexity", "ai-overviews", "copilot", "claude",
];

const TARGET_MODULE_BY_CATEGORY: Record<string, string> = {
  content: "/gtm",
  technical: "/projects",
  authority: "/nexus-flow",
  competitive: "/nexus-flow",
};

function asPlatformKey(p: string): SLPlatformKey {
  return (VALID_PLATFORM_KEYS.includes(p as SLPlatformKey) ? p : "chatgpt") as SLPlatformKey;
}

function capitalize(s: string): "Content" | "Technical" | "Authority" | "Competitive" {
  const lower = s.toLowerCase();
  if (lower === "technical") return "Technical";
  if (lower === "authority") return "Authority";
  if (lower === "competitive") return "Competitive";
  return "Content";
}

function deriveCitedDomains(citations: CitationEntry[]): CitedDomainEntry[] {
  const map = new Map<string, { mentionCount: number; authoritySum: number; n: number }>();
  for (const c of citations) {
    if (!c.sources || c.sources.length === 0) continue;
    for (const src of c.sources) {
      let host = src;
      try { host = new URL(src).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
      const cur = map.get(host) ?? { mentionCount: 0, authoritySum: 0, n: 0 };
      cur.mentionCount += 1;
      cur.authoritySum += c.authority;
      cur.n += 1;
      map.set(host, cur);
    }
  }
  return Array.from(map.entries())
    .map(([domain, v]) => {
      const avgAuthority = v.n > 0 ? Math.round(v.authoritySum / v.n) : 0;
      return {
        domain,
        mentionCount: v.mentionCount,
        avgAuthority,
        score: Math.round(avgAuthority * 0.6 + Math.min(v.mentionCount, 10) * 4),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function derivePrompts(citations: CitationEntry[]): PromptEntry[] {
  const map = new Map<string, { hits: number; total: number; platforms: Record<string, boolean>; lastChecked: string }>();
  for (const c of citations) {
    const cur = map.get(c.prompt) ?? { hits: 0, total: 0, platforms: {}, lastChecked: c.date };
    cur.total += 1;
    if (c.position !== "absent") cur.hits += 1;
    cur.platforms[c.platform] = c.position !== "absent" || cur.platforms[c.platform] === true;
    if (c.date > cur.lastChecked) cur.lastChecked = c.date;
    map.set(c.prompt, cur);
  }
  return Array.from(map.entries()).map(([prompt, v], i) => ({
    id: `${i}-${prompt}`,
    prompt,
    score: v.total > 0 ? Math.round((v.hits / v.total) * 100) : 0,
    platforms: v.platforms,
    competitorCount: 0,
    lastChecked: v.lastChecked,
    trendData: [],
  }));
}

function projectScanProToResults(raw: ScanProResponseLike, fallbackBrand: string): ScanResults {
  const today = new Date().toISOString().slice(0, 10);
  const citations: CitationEntry[] = (raw.citations ?? []).map((c, i) => ({
    id: String(i),
    platform: asPlatformKey(c.platform),
    prompt: c.prompt,
    position: c.position,
    context: c.context ?? "",
    sentiment: c.sentiment,
    authority: typeof c.authorityScore === "number" ? c.authorityScore : 0,
    sources: c.citationUrl ? [c.citationUrl] : [],
    date: today,
  }));

  const insights: InsightEntry[] = (raw.insights ?? []).map((ins, i) => {
    const cat = capitalize(typeof ins.category === "string" ? ins.category : "content");
    return {
      id: String(i),
      priority: ins.priority,
      title: ins.title,
      description: ins.description,
      action: ins.action ?? ins.actionItem ?? "",
      category: cat,
      targetModule: TARGET_MODULE_BY_CATEGORY[cat.toLowerCase()] ?? "/gtm",
    };
  });

  // platformBreakdown: scan-pro returns Record<string, PlatformScore>; history returns array.
  let platformBreakdown: PlatformBreakdownEntry[] = [];
  const pb = raw.platformBreakdown;
  if (Array.isArray(pb)) {
    platformBreakdown = pb;
  } else if (pb && typeof pb === "object") {
    platformBreakdown = Object.entries(pb).map(([key, v]) => ({
      key,
      mentions: v.mentions ?? 0,
      score: v.score ?? 0,
      trend: "+0%",
      trendUp: null,
    }));
  }

  const competitorComparison: CompetitorEntry[] = (raw.competitorComparison ?? []).map((c) => ({
    name: c.name,
    mentionCount: c.mentionCount ?? c.mentions ?? 0,
    promptsAppearedIn: c.promptsAppearedIn ?? [],
  }));

  return {
    brandName: raw.brandName ?? fallbackBrand,
    domain: raw.domain ?? null,
    visibilityScore: raw.visibilityScore ?? 0,
    citationCount: raw.citationCount ?? raw.mentionedIn ?? citations.filter((c) => c.position !== "absent").length,
    shareOfVoice: raw.shareOfVoice ?? 0,
    recommendationRate: raw.recommendationRate ?? 0,
    citationAuthority: raw.citationAuthority ?? 0,
    sentiment: raw.sentiment ?? { positive: 0, neutral: 0, negative: 0 },
    platformBreakdown,
    promptGaps: raw.promptGaps ?? [],
    competitorComparison,
    citations,
    insights,
    prompts: raw.prompts ?? derivePrompts(citations),
    citedDomains: raw.citedDomains ?? deriveCitedDomains(citations),
    scannedAt: raw.scannedAt ?? new Date().toISOString(),
    totalPromptsScanned: raw.totalPromptsScanned ?? new Set(citations.map((c) => c.prompt)).size,
  };
}

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
  const [tab, setTab] = useState<string>("Overview");

  // Read ?tab= from URL on mount for direct linking (e.g. notifications link to ?tab=Tracked).
  // Reading via window.location avoids a CSR bailout from useSearchParams during static export.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q && (TAB_OPTIONS as readonly string[]).includes(q)) setTab(q);
  }, []);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SearchLensSettings | null>(null);
  const [, setSettingsLoaded] = useState(false);
  // New UI state for the redesigned scan flow
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [prefilledDomain, setPrefilledDomain] = useState<string>("");
  const [currentScanPlatformIdx, setCurrentScanPlatformIdx] = useState(0);
  const [activeDomain, setActiveDomain] = useState<string>("");
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Load settings and latest scan on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const res = await fetch("/xapi/settings");
        if (res.ok) {
          const json = (await res.json()) as { data: SearchLensSettings };
          setSettings(json.data ?? null);
        }
      } catch {
        // settings load failed — use fallbacks
      }
      setSettingsLoaded(true);

      // Try to load latest scan from history. If endpoint is missing or
      // returns null data, leave scanResults null — empty states will render.
      try {
        const historyRes = await fetch("/xapi/searchlens/history?limit=1");
        if (historyRes.ok) {
          const historyJson = (await historyRes.json()) as { data?: ScanResults | null };
          if (historyJson.data) {
            setScanResults(historyJson.data);
          }
        }
      } catch {
        // history not available — leave pre-scan empty state in place
      }
    }
    void loadInitialData();
  }, []);

  // Open the scan setup modal; optionally pre-fill the domain from the hero CTA
  const openScanModal = useCallback((domainHint: string = "") => {
    setPrefilledDomain(domainHint);
    setScanModalOpen(true);
  }, []);

  // Execute the actual scan once the user has filled in the modal
  const executeScan = useCallback(async (config: ScanSetupConfig) => {
    setScanModalOpen(false);
    const brandName = config.brand;
    const prompts = config.prompts.length > 0
      ? config.prompts
      : (settings?.searchlens_prompts ?? []);
    if (!brandName || prompts.length === 0) {
      setScanError("Please provide a brand name and at least one prompt.");
      return;
    }
    if (config.domain) setActiveDomain(config.domain);

    const competitors = config.competitors.length > 0
      ? config.competitors
      : (settings?.searchlens_competitors ?? ["WebFX", "Siege Media", "Jasper Agency", "Single Grain"]);
    const platforms = settings?.searchlens_platforms ?? ["chatgpt", "gemini", "perplexity", "ai-overviews", "copilot", "claude"];

    setScanLoading(true);
    setScanError(null);
    setCurrentScanPlatformIdx(0);
    setScanProgress(`Scanning ${platforms.length} AI platforms across ${prompts.length} prompts...`);

    try {
      const response = await fetch("/xapi/searchlens/scan-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, prompts, competitors, platforms }),
      });

      // Fall back to basic scan endpoint if scan-pro is not available
      if (response.status === 404) {
        setScanProgress("Using standard scan engine...");
        const fallbackResponse = await fetch("/xapi/searchlens/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandName, prompts, competitors }),
        });
        const fallbackJson: { data?: ScanProResponseLike; error?: string } = await fallbackResponse.json();
        if (!fallbackResponse.ok || fallbackJson.error) {
          throw new Error(fallbackJson.error ?? `Request failed with status ${fallbackResponse.status}`);
        }
        if (fallbackJson.data) {
          setScanResults(projectScanProToResults(fallbackJson.data, brandName));
        }
        return;
      }

      const json: { data?: ScanProResponseLike; error?: string } = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error ?? `Request failed with status ${response.status}`);
      }
      if (json.data) {
        setScanResults(projectScanProToResults(json.data, brandName));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanError(message);
    } finally {
      setScanLoading(false);
      setScanProgress("");
    }
  }, [settings]);

  // Persist a newly added prompt to user settings.
  const handleAddPrompt = useCallback(async (prompt: string): Promise<void> => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const next = [...(settings?.searchlens_prompts ?? []), trimmed];
    try {
      const res = await fetch("/xapi/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ searchlens_prompts: next }),
      });
      if (!res.ok) {
        showToast("Failed to add prompt", "error");
        return;
      }
      const json = (await res.json()) as { data?: SearchLensSettings };
      setSettings(json.data ?? { ...(settings ?? {}), searchlens_prompts: next });
      showToast("Prompt added — run scan to score it", "success");
    } catch {
      showToast("Failed to add prompt", "error");
    }
  }, [settings, showToast]);

  // While scanning, advance the visual platform stepper to fake per-platform progress.
  // Real scan is parallel under the hood — this is purely UX feedback.
  useEffect(() => {
    if (!scanLoading) {
      setCurrentScanPlatformIdx(0);
      return;
    }
    const platforms = settings?.searchlens_platforms ?? ["chatgpt", "gemini", "perplexity", "ai-overviews", "copilot", "claude"];
    const promptCount = settings?.searchlens_prompts?.length ?? 6;
    const totalEta = promptCount * 10; // matches old banner heuristic
    const stepMs = Math.max(800, (totalEta * 1000) / platforms.length);
    const id = setInterval(() => {
      setCurrentScanPlatformIdx((i) => Math.min(i + 1, platforms.length - 1));
    }, stepMs);
    return () => clearInterval(id);
  }, [scanLoading, settings]);

  // Derived display data — real scan only; pre-scan shows zeros.
  const visibilityScore = scanResults?.visibilityScore ?? 0;
  const citationsFound = scanResults?.citationCount ?? 0;
  const shareOfVoice = scanResults?.shareOfVoice ?? 0;
  const recommendationRate = scanResults?.recommendationRate ?? 0;
  const citationAuthority = scanResults?.citationAuthority ?? 0;

  // Pre-scan state: nothing has ever been scanned successfully
  const isPreScan = scanResults === null && !scanLoading;
  const platformLabels = (settings?.searchlens_platforms ?? ["chatgpt", "gemini", "perplexity", "ai-overviews", "copilot", "claude"])
    .map((k) => PLATFORMS.find((p) => p.key === (k as PlatformKey))?.name ?? k);
  const promptCountForEta = settings?.searchlens_prompts?.length ?? 6;

  return (
    <div className="animate-in fade-in duration-300">
      {/* Hero — shown only before the first scan */}
      {isPreScan && (
        <div className="mb-6">
          <SearchLensHero
            scanning={scanLoading}
            onCheck={(d) => openScanModal(d)}
          />
        </div>
      )}

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
            onClick={() => openScanModal(activeDomain)}
            disabled={scanLoading}
            className="bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            size="sm"
          >
            {scanLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Radar className="w-3.5 h-3.5" data-icon="inline-start" />
            )}
            {scanLoading ? "Scanning..." : isPreScan ? "Run Scan" : "Run new scan"}
          </Button>
          <SegmentedControl
            options={[...TAB_OPTIONS]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {/* Scan Setup Modal */}
      <ScanSetupModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onSubmit={(cfg) => void executeScan(cfg)}
        defaults={{
          brand: settings?.searchlens_brand_name ?? "Creative Nexus",
          domain: prefilledDomain || activeDomain,
          prompts: settings?.searchlens_prompts ?? [
            "best digital marketing agency in India",
            "AI-powered marketing agency",
            "best agency for AI search optimization",
          ],
          competitors: settings?.searchlens_competitors ?? ["WebFX", "Siege Media", "Jasper Agency", "Single Grain"],
        }}
      />

      {/* Scan Error */}
      {scanError && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
          <span>{scanError}</span>
        </div>
      )}

      {/* Scan Progress Stepper (replaces old ScanningBanner) */}
      {scanLoading && (
        <ScanProgressStepper
          platforms={platformLabels}
          currentIdx={currentScanPlatformIdx}
          promptCount={promptCountForEta}
          etaSeconds={Math.max(0, promptCountForEta * 10)}
        />
      )}
      {scanLoading && scanProgress && (
        <p className="-mt-3 mb-4 text-[11px] text-foreground-tertiary">{scanProgress}</p>
      )}

      {/* Tab Content */}
      {tab === "Overview" && (
        <OverviewTab
          visibilityScore={visibilityScore}
          citationsFound={citationsFound}
          shareOfVoice={shareOfVoice}
          recommendationRate={recommendationRate}
          citationAuthority={citationAuthority}
          platformData={scanResults?.platformBreakdown ?? []}
          citedDomains={scanResults?.citedDomains ?? []}
          sentiment={scanResults?.sentiment ?? null}
          promptGaps={(scanResults?.promptGaps ?? []).map((p, i) => ({ id: i + 1, prompt: p, competitors: ["Competitor"], platform: "AI Search" }))}
          scanLoading={scanLoading}
          hasScan={scanResults !== null}
        />
      )}
      {tab === "Citations" && (
        <CitationsTab
          citations={scanResults?.citations ?? []}
          yourBrand={scanResults?.brandName ?? settings?.searchlens_brand_name ?? ""}
          onRunScan={() => openScanModal(activeDomain)}
        />
      )}
      {tab === "Competitors" && (
        <CompetitorsTab
          competitors={
            scanResults
              ? scanResults.competitorComparison.map((c, i) => {
                  const total = Math.max(scanResults.totalPromptsScanned, 1);
                  const score = Math.round((c.mentionCount / total) * 100);
                  return {
                    rank: i + 1,
                    name: c.name,
                    visibilityScore: score,
                    citations: c.mentionCount,
                    shareOfVoice: Math.round((c.mentionCount / total) * 1000) / 10,
                    recommendationRate: Math.round(score * 0.45),
                    promptsYouMiss: c.promptsAppearedIn.slice(0, 3),
                  };
                })
              : []
          }
          yourBrand={scanResults?.brandName ?? "Your Brand"}
          onRunScan={() => openScanModal(activeDomain)}
        />
      )}
      {tab === "Prompts" && (
        <PromptsTab
          prompts={scanResults?.prompts ?? []}
          brandName={settings?.searchlens_brand_name ?? scanResults?.brandName ?? ""}
          onAddPrompt={handleAddPrompt}
          onRunScan={() => openScanModal(activeDomain)}
          onTracked={() => {
            showToast("Tracking enabled", "success");
            setTab("Tracked");
          }}
          onTrackError={(msg) => showToast(msg, "error")}
        />
      )}
      {tab === "Tracked" && (
        <TrackedPromptsTab
          brandName={settings?.searchlens_brand_name ?? scanResults?.brandName ?? ""}
          onRunScan={() => setTab("Prompts")}
        />
      )}
      {tab === "Insights" && (
        <InsightsTab
          insights={scanResults?.insights ?? []}
          onRunScan={() => openScanModal(activeDomain)}
        />
      )}
      {tab === "Site Audit" && (
        <SiteAuditTab domain={activeDomain || prefilledDomain || ""} />
      )}

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-in slide-in-from-bottom-2 fade-in duration-300 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-success text-white"
                : toast.type === "error"
                  ? "bg-destructive text-white"
                  : "bg-foreground text-background"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared empty-state card                                             */
/* ------------------------------------------------------------------ */

function EmptyTab({
  icon: Icon,
  title,
  message,
  cta,
}: {
  icon: typeof Lightbulb;
  title: string;
  message: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-background-secondary rounded-[12px] p-8 dark:border dark:border-border text-center backdrop-blur-md">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 mb-3">
        <Icon className="w-5 h-5 text-accent" strokeWidth={1.8} />
      </div>
      <h3 className="text-[14px] font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-[12px] text-foreground-tertiary leading-relaxed mb-3 max-w-md mx-auto">{message}</p>
      {cta && (
        <Button
          size="sm"
          onClick={cta.onClick}
          className="bg-accent text-white hover:bg-accent/90"
        >
          <Radar className="w-3.5 h-3.5" data-icon="inline-start" />
          {cta.label}
        </Button>
      )}
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
  platformData: PlatformBreakdownEntry[];
  citedDomains: CitedDomainEntry[];
  sentiment: { positive: number; neutral: number; negative: number } | null;
  promptGaps: Array<{ id: number; prompt: string; competitors: string[]; platform: string }>;
  scanLoading: boolean;
  hasScan: boolean;
}

function OverviewTab({
  visibilityScore,
  citationsFound,
  shareOfVoice,
  recommendationRate,
  citationAuthority,
  platformData,
  citedDomains,
  sentiment,
  promptGaps,
  scanLoading,
  hasScan,
}: OverviewTabProps) {
  const [selectedPillar, setSelectedPillar] = useState(1); // 0-indexed into scorePillars

  /* -- Score Breakdown mock data -- */
  const scorePillars = [
    {
      label: "AI Citation Score",
      icon: MessageSquare,
      score: 6,
      status: "Needs Work" as const,
      contribution: 20,
      insight: "Your brand is rarely cited by AI search engines. Most responses reference competitor content instead.",
      quickFix: "Publish authoritative, long-form content that directly answers common AI prompts in your niche.",
    },
    {
      label: "SEO Health",
      icon: Search,
      score: 19,
      status: "Needs Work" as const,
      contribution: 30,
      insight: "Core Web Vitals and technical SEO issues are limiting your discoverability by AI crawlers.",
      quickFix: "Fix critical site speed issues and add structured data (JSON-LD) for Organization and Service schemas.",
    },
    {
      label: "Local Search",
      icon: MapPin,
      score: 13,
      status: "Needs Work" as const,
      contribution: 15,
      insight: "Your Google Business Profile is incomplete and you have few local citations across directories.",
      quickFix: "Complete your GBP profile, add service-area pages, and build citations on top Indian directories.",
    },
    {
      label: "Video Search",
      icon: Video,
      score: 9,
      status: "Needs Work" as const,
      contribution: 15,
      insight: "No video content appears in AI-generated answers. Competitors with YouTube presence rank significantly higher.",
      quickFix: "Create 3-5 expert videos answering top industry prompts and optimize with transcripts and chapters.",
    },
    {
      label: "Authority Signals",
      icon: Shield,
      score: 17,
      status: "Needs Work" as const,
      contribution: 20,
      insight: "Low backlink count from authoritative domains. AI models weigh domain authority heavily in citation decisions.",
      quickFix: "Launch a digital PR campaign targeting industry publications and secure guest posts on high-DA sites.",
    },
  ];

  const pillar = scorePillars[selectedPillar];
  const worstPillarIdx = scorePillars.reduce((minIdx, p, i, arr) => p.score < arr[minIdx].score ? i : minIdx, 0);

  /* -- Competitive landscape mock data -- */
  const competitiveLandscape = [
    { name: "Creative Nexus", score: 14, isYou: true },
    { name: "Kinnect", score: 61, isYou: false },
    { name: "Interactive Avenues", score: 58, isYou: false },
    { name: "WATConsult", score: 56, isYou: false },
  ];
  const topCompetitor = competitiveLandscape.filter(c => !c.isYou).sort((a, b) => b.score - a.score)[0];
  const totalCompScore = competitiveLandscape.reduce((sum, c) => sum + c.score, 0);

  /* -- Top keywords & prompts mock data -- */
  const topKeywords = [
    { keyword: "digital marketing agency India", score: 23 },
    { keyword: "AI marketing agency", score: 18 },
    { keyword: "creative agency Mumbai", score: 14 },
  ];
  const topPrompts = [
    { prompt: "Best digital agency for AI search", intent: "Commercial", score: 31 },
    { prompt: "Top creative agencies in India 2026", intent: "Commercial", score: 24 },
    { prompt: "Agency for AI-powered campaigns", intent: "Commercial", score: 19 },
  ];

  return (
    <div className="space-y-4">
      {/* Download Report Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => alert("Report download coming soon")}
        >
          <Download className="w-3.5 h-3.5" data-icon="inline-start" />
          Download Report
        </Button>
      </div>

      {/* Hero Metrics Row — frosted-glass GlowCards on dark canvas */}
      {!scanLoading && (
        <div className="grid grid-cols-5 gap-3 rounded-[14px] bg-foreground p-3 text-background">
          {/* Visibility Score */}
          <GlowCard glow className="!p-4 !bg-white/[0.04] !border-white/10 text-background relative">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Visibility Score
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <ScoreRing score={visibilityScore} size={64} strokeWidth={5} />
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-tight text-background">
                  <ScoreCountUp target={visibilityScore} />
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
          </GlowCard>

          {/* Citations Found */}
          <GlowCard className="!p-4 !bg-white/[0.04] !border-white/10 text-background">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Citations Found
            </div>
            <div className="text-3xl font-bold tracking-tight">
              <ScoreCountUp target={citationsFound} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
              <span className="text-xs font-medium text-success">+5 this week</span>
            </div>
          </GlowCard>

          {/* Share of Voice */}
          <GlowCard className="!p-4 !bg-white/[0.04] !border-white/10 text-background">
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
          </GlowCard>

          {/* Recommendation Rate */}
          <GlowCard className="!p-4 !bg-white/[0.04] !border-white/10 text-background">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Recommendation Rate
            </div>
            <div className="text-3xl font-bold tracking-tight">{recommendationRate}%</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />
              <span className="text-xs font-medium text-success">+2% vs last scan</span>
            </div>
          </GlowCard>

          {/* Citation Authority */}
          <GlowCard className="!p-4 !bg-white/[0.04] !border-white/10 text-background">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/50 mb-2">
              Citation Authority
            </div>
            <div className="text-3xl font-bold tracking-tight">{citationAuthority}<span className="text-lg text-background/40">/100</span></div>
            <div className="mt-2">
              <ProgressBar value={citationAuthority} color="accent" />
            </div>
          </GlowCard>
        </div>
      )}

      {/* Platform Breakdown Row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">Platform Breakdown</span>
          <span className="text-xs text-foreground-tertiary">6 AI platforms monitored</span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {(platformData.length > 0
            ? platformData
            : PLATFORMS.map<PlatformBreakdownEntry>((p) => ({ key: p.key, mentions: 0, score: 0, trend: "0%", trendUp: null }))
          ).map((pData) => {
            const platformInfo = PLATFORMS.find((p) => p.key === (pData.key as PlatformKey));
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

      {/* Top Cited Sources — only shown when we have citation data */}
      {hasScan && citedDomains.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-foreground">Top Cited Sources</span>
            <span className="text-xs text-foreground-tertiary">{citedDomains.length} domains</span>
          </div>
          <GlowCard className="!p-0 overflow-hidden">
            {citedDomains.slice(0, 5).map((d, i) => (
              <div key={d.domain}>
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="text-[11px] font-bold text-foreground-tertiary w-5 text-center">{i + 1}.</span>
                  <Globe className="w-3.5 h-3.5 text-foreground-tertiary shrink-0" strokeWidth={1.8} />
                  <span className="text-[13px] font-medium text-foreground flex-1 truncate">{d.domain}</span>
                  <span className="text-[11px] text-foreground-tertiary">
                    {d.mentionCount} {d.mentionCount === 1 ? "mention" : "mentions"}
                  </span>
                  <StatusBadge type={d.avgAuthority >= 70 ? "success" : d.avgAuthority >= 40 ? "warning" : "neutral"}>
                    {d.avgAuthority > 0 ? `Auth ${d.avgAuthority}` : "Auth --"}
                  </StatusBadge>
                </div>
                {i < Math.min(citedDomains.length, 5) - 1 && <div className="h-px bg-divider mx-3.5" />}
              </div>
            ))}
          </GlowCard>
        </div>
      )}

      {/* ====== Section 1: Score Breakdown — "What Makes Up Your Score" ====== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">What Makes Up Your Score</span>
          <span className="text-xs text-foreground-tertiary">5 pillars evaluated</span>
        </div>

        {/* Pillar cards row */}
        <div className="grid grid-cols-5 gap-3 mb-3">
          {scorePillars.map((p, i) => {
            const PillarIcon = p.icon;
            const isSelected = i === selectedPillar;
            const isWorst = i === worstPillarIdx;
            return (
              <button
                key={p.label}
                onClick={() => setSelectedPillar(i)}
                className={`bg-background-secondary rounded-[10px] p-3.5 dark:border text-left transition-all ${
                  isSelected
                    ? "border-2 border-accent ring-1 ring-accent/20"
                    : isWorst
                      ? "border border-accent/40 dark:border-accent/40"
                      : "dark:border-border border border-transparent hover:border-accent/20"
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-accent/10" : "bg-foreground/5 dark:bg-foreground/10"}`}>
                    <PillarIcon className={`w-4 h-4 ${isSelected ? "text-accent" : "text-foreground-secondary"}`} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="text-[11px] text-foreground-tertiary text-center mb-1 leading-tight">{p.label}</div>
                <div className={`text-xl font-bold text-center tracking-tight ${isSelected ? "text-accent" : "text-foreground"}`}>
                  {p.score}%
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected pillar detail */}
        {pillar && (
          <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-foreground">{pillar.label}</span>
                <span className="text-lg font-bold text-accent">{pillar.score}%</span>
                <StatusBadge type={pillar.score >= 60 ? "success" : pillar.score >= 40 ? "warning" : "error"}>
                  {pillar.score >= 60 ? "Excellent" : pillar.score >= 40 ? "Good" : "Needs Work"}
                </StatusBadge>
              </div>
              <span className="text-xs text-foreground-tertiary">
                Contributes {pillar.contribution}% to your overall score
              </span>
            </div>
            <ProgressBar value={pillar.score} color="accent" className="mb-3" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">Insight</div>
                <p className="text-[12px] text-foreground-secondary leading-relaxed">{pillar.insight}</p>
              </div>
              <div>
                <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">Quick Fix</div>
                <p className="text-[12px] text-foreground-secondary leading-relaxed">{pillar.quickFix}</p>
              </div>
            </div>
          </div>
        )}

        {/* Biggest Opportunity */}
        <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border border-l-2 border-l-accent">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-accent mt-0.5 shrink-0" strokeWidth={1.8} />
            <div>
              <div className="text-[13px] font-semibold text-foreground mb-1">Biggest Opportunity</div>
              <p className="text-[12px] text-foreground-secondary leading-relaxed">
                <span className="font-semibold text-foreground">SEO Health</span> has the highest impact potential. Improving this pillar could increase your overall score by up to <span className="font-bold text-accent">+17 points</span>.
              </p>
              <p className="text-[12px] text-foreground-secondary leading-relaxed mt-1">
                <span className="font-medium text-foreground">Quick fix:</span> Fix critical site speed issues and add structured data (JSON-LD) for Organization and Service schemas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== Section 2: Brand Perception — "What ChatGPT Knows About Your Brand" ====== */}
      <div>
        <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1.5">Brand Perception</div>
        <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
          <h3 className="text-[14px] font-semibold text-foreground mb-0.5">What ChatGPT Knows About Your Brand</h3>
          <p className="text-[12px] text-foreground-tertiary mb-3">How ChatGPT currently perceives and describes your brand</p>
          <ul className="space-y-2">
            {[
              "Provides creative design and branding services",
              "Offers website design and development solutions",
              "Delivers digital marketing and social media campaigns",
              "Serves businesses in India seeking online presence",
            ].map((point) => (
              <li key={point} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <span className="text-[13px] text-foreground-secondary leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ====== Section 3: Revenue Risk Warning ====== */}
      <div className="bg-warning/5 rounded-[10px] p-4 border-l-2 border-l-warning dark:border dark:border-border dark:border-l-warning">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" strokeWidth={1.8} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge type="warning">Revenue Risk</StatusBadge>
            </div>
            <h3 className="text-[14px] font-semibold text-foreground mb-1">AI is sending your customers to your competitors</h3>
            <p className="text-[12px] text-foreground-secondary leading-relaxed mb-3">
              Based on your SearchScore and competitor visibility across AI search engines: Brands with low AI Search visibility lose 40-60% of Search assisted revenue to competitors recommended by AI search engines.
            </p>
            <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-2">What This Means</div>
            <ul className="space-y-1.5">
              {[
                "Competitors are being recommended before users reach Google",
                "Your brand is missing at the decision stage",
                "Demand exists, but AI is redirecting it elsewhere",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                  <span className="text-[13px] text-foreground-secondary leading-snug">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ====== Section 4: Competitive Landscape (Donut Chart Style) ====== */}
      <div>
        <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1.5">Market Position</div>
        <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[14px] font-semibold text-foreground">Competitive Landscape</h3>
            <span className="text-xs text-foreground-tertiary">Compare your AI visibility against competitors</span>
          </div>
          <p className="text-[12px] text-accent font-medium mb-4">
            AI picked {topCompetitor.name} first. They&apos;re already {topCompetitor.score - (competitiveLandscape.find(c => c.isYou)?.score ?? 0)}% ahead.
          </p>
          <div className="grid grid-cols-[180px_1fr] gap-6 items-center">
            {/* CSS-only donut chart */}
            <div className="relative w-[160px] h-[160px] mx-auto">
              <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                {(() => {
                  let cumulativePercent = 0;
                  const radius = 60;
                  const circumference = 2 * Math.PI * radius;
                  const colors = ["#D90A2C", "#10A37F", "#4285F4", "#D97706"];
                  return competitiveLandscape.map((c, i) => {
                    const percent = c.score / totalCompScore;
                    const dashArray = percent * circumference;
                    const dashOffset = -cumulativePercent * circumference;
                    cumulativePercent += percent;
                    return (
                      <circle
                        key={c.name}
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke={colors[i % colors.length]}
                        strokeWidth="24"
                        strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                        strokeDashoffset={dashOffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{competitiveLandscape.find(c => c.isYou)?.score ?? 0}%</span>
                <span className="text-[10px] text-foreground-tertiary">Your Score</span>
              </div>
            </div>

            {/* Leaderboard list */}
            <div className="space-y-2.5">
              {[...competitiveLandscape].sort((a, b) => b.score - a.score).map((c) => {
                const colors: Record<string, string> = {
                  "Creative Nexus": "bg-[#D90A2C]",
                  "Kinnect": "bg-[#10A37F]",
                  "Interactive Avenues": "bg-[#4285F4]",
                  "WATConsult": "bg-[#D97706]",
                };
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[c.name] ?? "bg-foreground-tertiary"}`} />
                    <span className={`text-[13px] font-medium min-w-[140px] ${c.isYou ? "text-accent" : "text-foreground"}`}>
                      {c.name}
                      {c.isYou && <span className="text-[10px] ml-1 text-accent/60">(You)</span>}
                    </span>
                    <div className="flex-1 h-2 bg-divider rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${c.isYou ? "bg-accent" : "bg-foreground/30 dark:bg-foreground/20"}`}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <span className="text-[13px] font-bold text-foreground w-10 text-right">{c.score}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ====== Section 5: Top Keywords + Top Prompts (side by side) ====== */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top Keywords */}
        <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">Keyword Visibility</div>
          <h3 className="text-[14px] font-semibold text-foreground mb-3">Top 3 Visible Keywords</h3>
          <div className="space-y-3">
            {topKeywords.map((kw, i) => (
              <div key={kw.keyword} className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-accent w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate mb-1">{kw.keyword}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-divider rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${kw.score}%` }} />
                    </div>
                    <span className="text-[12px] font-semibold text-foreground w-8 text-right">{kw.score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Prompts */}
        <div className="bg-background-secondary rounded-[10px] p-4 dark:border dark:border-border">
          <div className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider mb-1">Prompt Rankings</div>
          <h3 className="text-[14px] font-semibold text-foreground mb-3">Top 3 Prompts</h3>
          <div className="space-y-3">
            {topPrompts.map((tp, i) => (
              <div key={tp.prompt} className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-accent w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-foreground truncate">{tp.prompt}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent shrink-0">
                      {tp.intent}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-divider rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${tp.score}%` }} />
                    </div>
                    <span className="text-[12px] font-semibold text-foreground w-8 text-right">{tp.score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
          <SentimentBar label="Positive" value={sentiment?.positive ?? 0} color="bg-success" />
          <SentimentBar label="Neutral" value={sentiment?.neutral ?? 0} color="bg-foreground-tertiary" />
          <SentimentBar label="Negative" value={sentiment?.negative ?? 0} color="bg-destructive" />
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

const sentimentLabels: Record<string, { label: string; type: "success" | "warning" | "neutral" }> = {
  positive: { label: "Positive", type: "success" },
  neutral: { label: "Neutral", type: "neutral" },
  negative: { label: "Negative", type: "warning" },
};

function CitationsTab({
  citations,
  yourBrand,
  onRunScan,
}: {
  citations: CitationEntry[];
  yourBrand?: string;
  onRunScan: () => void;
}) {
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

  // Render LLM response text with optional brand-name highlighting (case-insensitive).
  const renderHighlighted = (text: string): ReactNode => {
    const brand = yourBrand?.trim();
    if (!brand) return text;
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(re);
    const lowerBrand = brand.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === lowerBrand ? (
        <span key={i} className="bg-accent/20 text-accent px-1 rounded font-medium">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  // Rough relative-time helper based on the citation date string (YYYY-MM-DD).
  const relativeTime = (dateStr: string): string => {
    const then = new Date(dateStr).getTime();
    if (Number.isNaN(then)) return dateStr;
    const days = Math.max(0, Math.round((Date.now() - then) / (1000 * 60 * 60 * 24)));
    if (days === 0) return "today";
    if (days === 1) return "1d ago";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.round(days / 7)}w ago`;
    return `${Math.round(days / 30)}mo ago`;
  };

  // Sentiment dot color
  const sentimentDot: Record<CitationEntry["sentiment"], string> = {
    positive: "bg-success",
    neutral: "bg-warning",
    negative: "bg-destructive",
  };

  if (citations.length === 0) {
    return (
      <EmptyTab
        icon={MessageSquare}
        title="No citations captured yet"
        message="Run a scan to see how AI engines reference your brand across ChatGPT, Gemini, Perplexity, and more."
        cta={{ label: "Run Scan", onClick: onRunScan }}
      />
    );
  }

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

      {/* Citation chat-bubble cards */}
      {filtered.length === 0 ? (
        <div className="bg-background-secondary rounded-[10px] px-3.5 py-8 text-center text-[13px] text-foreground-tertiary dark:border dark:border-border">
          No citations match the selected filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((citation) => {
            const platformInfo = PLATFORMS.find((p) => p.key === citation.platform);
            if (!platformInfo) return null;
            const Icon = platformInfo.icon;
            const sentInfo = sentimentLabels[citation.sentiment];
            const isTopPosition = citation.position === "prominent";
            const positionPillClass = isTopPosition
              ? "bg-success/10 text-success"
              : citation.position === "passing"
                ? "bg-warning/10 text-warning"
                : "bg-destructive/10 text-destructive";
            const positionLabel =
              citation.position === "prominent"
                ? "#1-3"
                : citation.position === "passing"
                  ? "passing"
                  : "absent";

            return (
              <article
                key={citation.id}
                className="bg-background-secondary rounded-[12px] p-4 dark:border dark:border-border"
              >
                {/* Header row: platform identity + meta */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg ${platformInfo.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${platformInfo.color}`} strokeWidth={2} />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{platformInfo.name}</span>
                  <span className="text-[11px] text-foreground-tertiary">·</span>
                  <span className="text-[11px] text-foreground-tertiary">{relativeTime(citation.date)}</span>
                  <span
                    className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${positionPillClass}`}
                  >
                    {positionLabel}
                  </span>
                </div>

                {/* Prompt */}
                <div className="text-[12px] italic text-foreground-tertiary mb-2.5">
                  Q: &ldquo;{citation.prompt}&rdquo;
                </div>

                {/* Response bubble */}
                <div className="bg-background dark:bg-white/5 backdrop-blur-md border border-white/10 rounded-[12px] p-4">
                  {citation.context ? (
                    <p className="text-[13px] leading-relaxed text-foreground-secondary">
                      &ldquo;{renderHighlighted(citation.context)}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[12px] italic text-foreground-tertiary">
                      No context captured for this citation.
                    </p>
                  )}
                </div>

                {/* Footer meta row */}
                <div className="flex items-center gap-3 flex-wrap mt-3 text-[11px] text-foreground-tertiary">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sentimentDot[citation.sentiment]}`} aria-hidden="true" />
                    <span className="text-foreground-secondary">{sentInfo.label}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Authority{" "}
                    <span className="text-foreground font-semibold">
                      {citation.authority > 0 ? citation.authority : "--"}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[11px] text-foreground-tertiary">{citation.date}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3: Competitors                                                 */
/* ------------------------------------------------------------------ */

interface CompetitorRow {
  rank: number;
  name: string;
  visibilityScore: number;
  citations: number;
  shareOfVoice: number;
  recommendationRate: number;
  promptsYouMiss: string[];
}

function CompetitorsTab({
  competitors,
  yourBrand,
  onRunScan,
}: {
  competitors: CompetitorRow[];
  yourBrand: string;
  onRunScan: () => void;
}) {
  if (competitors.length === 0) {
    return (
      <EmptyTab
        icon={Swords}
        title="No competitor data yet"
        message="Add competitors in Settings, then run a scan to see how you stack up across AI search engines."
        cta={{ label: "Run Scan", onClick: onRunScan }}
      />
    );
  }
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

function PromptsTab({
  prompts,
  brandName,
  onAddPrompt,
  onRunScan,
  onTracked,
  onTrackError,
}: {
  prompts: PromptEntry[];
  brandName: string;
  onAddPrompt: (prompt: string) => Promise<void>;
  onRunScan: () => void;
  onTracked?: () => void;
  onTrackError?: (msg: string) => void;
}) {
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [trackedSet, setTrackedSet] = useState<Set<string>>(new Set());
  const [trackingId, setTrackingId] = useState<string | null>(null);

  // Load existing tracked prompts so the Track button can show "Tracked" when applicable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/xapi/searchlens/tracked-prompts", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { items?: Array<{ prompt: string }> } };
        if (!cancelled) setTrackedSet(new Set((json.data?.items ?? []).map((it) => it.prompt)));
      } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const trackPrompt = useCallback(async (entry: PromptEntry) => {
    if (!brandName) { onTrackError?.("Set your brand name first"); return; }
    setTrackingId(entry.id);
    try {
      const res = await fetch("/xapi/searchlens/tracked-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: entry.prompt, brand_name: brandName }),
      });
      if (res.status === 400) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        onTrackError?.(j.error ?? "Tracking cap reached");
      } else if (!res.ok && res.status !== 409) {
        onTrackError?.(`Failed to track (${res.status})`);
      } else {
        setTrackedSet((prev) => new Set(prev).add(entry.prompt));
        onTracked?.();
      }
    } catch {
      onTrackError?.("Network error while tracking prompt");
    } finally { setTrackingId(null); }
  }, [brandName, onTracked, onTrackError]);

  const submit = useCallback(async () => {
    const value = draft.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      await onAddPrompt(value);
      setDraft("");
      setShowAddPrompt(false);
    } finally {
      setSubmitting(false);
    }
  }, [draft, onAddPrompt, submitting]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-semibold text-foreground">Monitored Prompts</span>
        <Button variant="outline" size="sm" onClick={() => setShowAddPrompt((v) => !v)}>
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <Button
            size="sm"
            className="bg-accent text-white hover:bg-accent/90"
            onClick={() => void submit()}
            disabled={submitting || draft.trim().length === 0}
          >
            {submitting ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {prompts.length === 0 ? (
        <EmptyTab
          icon={MessageSquare}
          title="No prompts tracked yet"
          message="Add prompts above to monitor, or run a scan to populate this list with the prompts you've configured."
          cta={{ label: "Run Scan", onClick: onRunScan }}
        />
      ) : (
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={trackedSet.has(entry.prompt) || trackingId === entry.id}
                    onClick={() => void trackPrompt(entry)}
                    title="Track this prompt daily"
                    aria-label={trackedSet.has(entry.prompt) ? "Already tracked" : "Track this prompt daily"}
                  >
                    <BellRing className="w-3 h-3" data-icon="inline-start" strokeWidth={2} />
                    {trackedSet.has(entry.prompt) ? "Tracked" : trackingId === entry.id ? "…" : "Track"}
                  </Button>
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
      )}
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

function InsightsTab({
  insights,
  onRunScan,
}: {
  insights: InsightEntry[];
  onRunScan: () => void;
}) {
  const sorted = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...insights].sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4));
  }, [insights]);

  if (insights.length === 0) {
    return (
      <EmptyTab
        icon={Lightbulb}
        title="Insights will appear after your first scan"
        message="We'll surface prioritised, actionable recommendations based on how AI engines describe your brand."
        cta={{ label: "Run Scan", onClick: onRunScan }}
      />
    );
  }

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
