"use client";

import { useState, useCallback } from "react";
import {
  Camera,
  AtSign,
  Send,
  Music2,
  BarChart3,
  Heart,
  Activity,
  Lightbulb,
  Hash,
  Sparkles,
  Film,
  Images,
  Image,
  FileText,
  type LucideIcon,
  ArrowUpRight,
  ArrowDownRight,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Microscope,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = "Instagram" | "Twitter" | "LinkedIn" | "TikTok";

interface MetricCard {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { direction: "up" | "down"; label: string };
}

interface TopPost {
  id: string;
  platform: Platform;
  caption: string;
  engagement: number;
  type: "Reel" | "Carousel" | "Static" | "Thread" | "Article" | "Video";
}

interface PlatformEngagement {
  platform: Platform;
  icon: LucideIcon;
  avgEngagement: string;
  trend: "up" | "down";
  trendDelta: string;
}

interface PatternCard {
  id: string;
  title: string;
  description: string;
  dataPoint: string;
  icon: LucideIcon;
}

interface HashtagGroup {
  label: string;
  color: string;
  textColor: string;
  tags: string[];
}

interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  whyItWorks: string;
  platform: Platform;
  confidence: "High" | "Medium";
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface AnalysisTopPost {
  caption: string;
  engagement: number;
  reason: string;
}

interface AnalysisBestPostType {
  type: string;
  avgEngagement: number;
}

interface AnalysisContentIdea {
  hook: string;
  format: string;
  rationale: string;
}

interface AnalysisData {
  performanceSnapshot: {
    avgEngagement: number;
    totalPosts: number;
    topPosts: AnalysisTopPost[];
    bottomPosts: AnalysisTopPost[];
  };
  contentPatterns: {
    winningHooks: string[];
    bestPostTypes: AnalysisBestPostType[];
    optimalCaptionLength: { min: number; max: number; unit: string };
  };
  hashtagIntelligence: {
    keep: string[];
    stop: string[];
    try: string[];
  };
  contentIdeas: AnalysisContentIdea[];
}

interface AnalysisResults {
  scrapeId: string;
  analysisId: string | null;
  platform: string;
  username: string;
  postsAnalysed: number;
  analysis: AnalysisData;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const defaultMetricCards: MetricCard[] = [
  {
    label: "Total Posts Analysed",
    value: "127",
    icon: BarChart3,
    trend: { direction: "up", label: "+14 from last month" },
  },
  {
    label: "Avg Engagement Rate",
    value: "4.8%",
    icon: Heart,
    trend: { direction: "up", label: "+0.6% vs prior" },
  },
  {
    label: "Top Platform",
    value: "Instagram",
    icon: Camera,
  },
  {
    label: "Content Health Score",
    value: "82/100",
    icon: Activity,
    trend: { direction: "up", label: "+5 pts this quarter" },
  },
];

const defaultTopPosts: TopPost[] = [
  {
    id: "p1",
    platform: "Instagram",
    caption: "Behind the scenes of our brand shoot day -- the team brought incredible energy and we captured something truly special for the Q2 campaign...",
    engagement: 2847,
    type: "Reel",
  },
  {
    id: "p2",
    platform: "LinkedIn",
    caption: "3 lessons from scaling a creative agency from 5 to 45 people in 18 months. Thread on what nobody tells you about rapid growth...",
    engagement: 1923,
    type: "Carousel",
  },
  {
    id: "p3",
    platform: "TikTok",
    caption: "POV: Your client asks for a logo redesign and you show them the brand strategy deck first. The reaction was priceless...",
    engagement: 4216,
    type: "Video",
  },
];

const defaultPlatformEngagement: PlatformEngagement[] = [
  { platform: "Instagram", icon: Camera, avgEngagement: "6.2%", trend: "up", trendDelta: "+1.1%" },
  { platform: "Twitter", icon: AtSign, avgEngagement: "3.1%", trend: "down", trendDelta: "-0.3%" },
  { platform: "LinkedIn", icon: Send, avgEngagement: "5.4%", trend: "up", trendDelta: "+0.8%" },
  { platform: "TikTok", icon: Music2, avgEngagement: "8.7%", trend: "up", trendDelta: "+2.4%" },
];

const defaultWinningPatterns: PatternCard[] = [
  {
    id: "w1",
    title: "Question-Led Hooks",
    description: "Posts starting with a direct question generate 2.3x more comments than statement-led openings.",
    dataPoint: "2.3x comment rate",
    icon: MessageSquare,
  },
  {
    id: "w2",
    title: "Carousel + Story Format",
    description: "Multi-slide carousels with a narrative arc retain 74% of viewers to the final slide.",
    dataPoint: "74% slide-through rate",
    icon: Images,
  },
  {
    id: "w3",
    title: "Optimal Caption Length",
    description: "Captions between 80-120 words outperform both shorter and longer alternatives across all platforms.",
    dataPoint: "80-120 words sweet spot",
    icon: FileText,
  },
];

const defaultAvoidPatterns: PatternCard[] = [
  {
    id: "a1",
    title: "Generic CTAs",
    description: "Posts ending with 'Link in bio' or 'DM us' see 41% lower engagement than posts with specific next steps.",
    dataPoint: "-41% engagement",
    icon: AlertTriangle,
  },
  {
    id: "a2",
    title: "Stock Photo Dependency",
    description: "Posts with stock imagery receive 58% fewer saves compared to original photos or branded graphics.",
    dataPoint: "-58% saves",
    icon: Image,
  },
];

const defaultHashtagGroups: HashtagGroup[] = [
  {
    label: "Keep Using",
    color: "bg-success/10",
    textColor: "text-success",
    tags: ["#creativestrategy", "#brandbuilding", "#agencylife", "#B2Bmarketing", "#contentcreation"],
  },
  {
    label: "Stop Using",
    color: "bg-destructive/10",
    textColor: "text-destructive",
    tags: ["#followforfollow", "#instagood", "#viral"],
  },
  {
    label: "Try These",
    color: "bg-accent/10",
    textColor: "text-accent",
    tags: ["#marketingplaybook", "#growthmindset", "#agencytips", "#creativeops"],
  },
];

const defaultContentIdeas: ContentIdea[] = [
  {
    id: "i1",
    title: "Client Transformation Reel",
    hook: "Show a 15-second before/after of a client's brand refresh with a trending audio overlay.",
    whyItWorks: "Reels with transformation narratives averaged 3.2x more shares in your last 30 posts.",
    platform: "Instagram",
    confidence: "High",
  },
  {
    id: "i2",
    title: "Agency Lessons Thread",
    hook: "'5 things I would tell my past self before starting an agency' -- vulnerable storytelling format.",
    whyItWorks: "Your top 3 LinkedIn posts by engagement all used numbered list + personal narrative format.",
    platform: "LinkedIn",
    confidence: "High",
  },
  {
    id: "i3",
    title: "Process Breakdown Carousel",
    hook: "Walk through your exact creative process from brief to delivery in 8 slides.",
    whyItWorks: "Process-reveal carousels had 74% slide-through rate vs 52% for other carousel types.",
    platform: "Instagram",
    confidence: "High",
  },
  {
    id: "i4",
    title: "Hot Take on AI in Creative",
    hook: "Controversial opinion: AI won't replace creatives -- but creatives who use AI will replace those who don't.",
    whyItWorks: "Polarising opinion posts drive 2.8x more comments. AI-adjacent content is trending +340% on X.",
    platform: "Twitter",
    confidence: "Medium",
  },
  {
    id: "i5",
    title: "Day-in-the-Life TikTok",
    hook: "Film a 60-second day in the life at the agency: morning standup, client call, creative review, team lunch.",
    whyItWorks: "Authenticity-driven TikToks average 8.7% engagement vs 4.1% for polished brand content.",
    platform: "TikTok",
    confidence: "High",
  },
  {
    id: "i6",
    title: "Myth-Busting Series",
    hook: "'Marketing myths that are costing you clients' -- debunk one common misconception per post.",
    whyItWorks: "Contrarian educational content saw 1.9x higher save rate, signalling algorithm-boosting value.",
    platform: "LinkedIn",
    confidence: "Medium",
  },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const tabs = ["Snapshot", "Patterns", "Ideas"] as const;
type Tab = (typeof tabs)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function platformIcon(platform: Platform): LucideIcon {
  switch (platform) {
    case "Instagram":
      return Camera;
    case "Twitter":
      return AtSign;
    case "LinkedIn":
      return Send;
    case "TikTok":
      return Music2;
  }
}

function postTypeBadge(type: TopPost["type"]): { color: string; icon: LucideIcon } {
  switch (type) {
    case "Reel":
    case "Video":
      return { color: "bg-accent/10 text-accent", icon: Film };
    case "Carousel":
      return { color: "bg-success/10 text-success", icon: Images };
    case "Static":
    case "Article":
      return { color: "bg-warning/10 text-warning", icon: Image };
    case "Thread":
      return { color: "bg-accent/10 text-accent", icon: FileText };
  }
}

function confidenceBadgeType(confidence: "High" | "Medium"): "success" | "warning" {
  return confidence === "High" ? "success" : "warning";
}

// ---------------------------------------------------------------------------
// Snapshot Tab
// ---------------------------------------------------------------------------

function SnapshotTab({
  metricCards,
  topPosts,
  platformEngagement,
  analysisLoading,
}: {
  metricCards: MetricCard[];
  topPosts: TopPost[];
  platformEngagement: PlatformEngagement[];
  analysisLoading: boolean;
}) {
  return (
    <div>
      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border relative"
          >
            {analysisLoading && (
              <div className="absolute inset-0 bg-background-secondary/80 rounded-[10px] flex items-center justify-center z-10">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0">
                <card.icon className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <div className="text-[22px] font-bold text-foreground tracking-tight">{card.value}</div>
            {card.trend && (
              <div className="flex items-center gap-1 mt-1">
                {card.trend.direction === "up" ? (
                  <ArrowUpRight className="w-3 h-3 text-success" strokeWidth={2.5} />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-destructive" strokeWidth={2.5} />
                )}
                <span className={`text-[11px] font-medium ${card.trend.direction === "up" ? "text-success" : "text-destructive"}`}>
                  {card.trend.label}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Top Performing Posts */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Top Performing Posts</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          Last 30 days
        </span>
      </div>
      <div className="bg-background-secondary rounded-[10px] overflow-hidden dark:border dark:border-border mb-5">
        {topPosts.map((post, i) => {
          const PlatformIcon = platformIcon(post.platform);
          const badge = postTypeBadge(post.type);
          const BadgeIcon = badge.icon;
          return (
            <div key={post.id}>
              <div className="flex items-center gap-3 px-3.5 py-3 bg-background dark:bg-background/40">
                <div className="w-8 h-8 rounded-full bg-background-secondary flex items-center justify-center shrink-0 dark:bg-foreground-tertiary/10">
                  <PlatformIcon className="w-4 h-4 text-foreground-secondary" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground leading-snug line-clamp-1">
                    {post.caption}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[12px] text-foreground-tertiary">{post.platform}</span>
                    <span className="text-foreground-tertiary">·</span>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-foreground-tertiary" strokeWidth={2} />
                      <span className="text-[12px] font-medium text-foreground-secondary">
                        {post.engagement.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.color}`}>
                  <BadgeIcon className="w-3 h-3" strokeWidth={2} />
                  {post.type}
                </span>
              </div>
              {i < topPosts.length - 1 && <div className="h-px bg-divider mx-3.5" />}
            </div>
          );
        })}
      </div>

      {/* Engagement by Platform */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-foreground">Engagement by Platform</span>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          Avg engagement rate
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {platformEngagement.map((item) => (
          <div
            key={item.platform}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-foreground-tertiary/8 flex items-center justify-center shrink-0">
                <item.icon className="w-3.5 h-3.5 text-foreground-secondary" strokeWidth={1.5} />
              </div>
              <span className="text-[13px] font-medium text-foreground">{item.platform}</span>
            </div>
            <div className="text-[20px] font-bold text-foreground tracking-tight">{item.avgEngagement}</div>
            <div className="flex items-center gap-1 mt-1">
              {item.trend === "up" ? (
                <ArrowUpRight className="w-3 h-3 text-success" strokeWidth={2.5} />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-destructive" strokeWidth={2.5} />
              )}
              <span className={`text-[11px] font-medium ${item.trend === "up" ? "text-success" : "text-destructive"}`}>
                {item.trendDelta}
              </span>
              <span className="text-[11px] text-foreground-tertiary">vs last month</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Patterns Tab
// ---------------------------------------------------------------------------

function PatternsTab({
  winningPatterns,
  avoidPatterns,
  hashtagGroups,
}: {
  winningPatterns: PatternCard[];
  avoidPatterns: PatternCard[];
  hashtagGroups: HashtagGroup[];
}) {
  return (
    <div>
      {/* What Works */}
      <div className="flex items-center gap-2 mb-2">
        <ThumbsUp className="w-3.5 h-3.5 text-success" strokeWidth={2} />
        <span className="text-[13px] font-semibold text-foreground">What Works</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {winningPatterns.map((pattern) => (
          <div
            key={pattern.id}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[7px] bg-success/10 flex items-center justify-center shrink-0">
                <pattern.icon className="w-3.5 h-3.5 text-success" strokeWidth={2} />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success">
                {pattern.dataPoint}
              </span>
            </div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">{pattern.title}</div>
            <p className="text-[12px] text-foreground-tertiary mt-1 leading-relaxed">{pattern.description}</p>
          </div>
        ))}
      </div>

      {/* What to Avoid */}
      <div className="flex items-center gap-2 mb-2">
        <ThumbsDown className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />
        <span className="text-[13px] font-semibold text-foreground">What to Avoid</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {avoidPatterns.map((pattern) => (
          <div
            key={pattern.id}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[7px] bg-destructive/10 flex items-center justify-center shrink-0">
                <pattern.icon className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive">
                {pattern.dataPoint}
              </span>
            </div>
            <div className="text-[13px] font-semibold text-foreground leading-tight">{pattern.title}</div>
            <p className="text-[12px] text-foreground-tertiary mt-1 leading-relaxed">{pattern.description}</p>
          </div>
        ))}
      </div>

      {/* Hashtag Intelligence */}
      <div className="flex items-center gap-2 mb-2">
        <Hash className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
        <span className="text-[13px] font-semibold text-foreground">Hashtag Intelligence</span>
      </div>
      <div className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border">
        <div className="space-y-3">
          {hashtagGroups.map((group) => (
            <div key={group.label}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${group.textColor}`}>
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {group.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium ${group.color} ${group.textColor}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ideas Tab
// ---------------------------------------------------------------------------

function IdeasTab({
  contentIdeas,
}: {
  contentIdeas: ContentIdea[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-foreground">AI-Generated Content Ideas</span>
        </div>
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
          Based on your last 127 posts
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {contentIdeas.map((idea) => {
          const PlatformIcon = platformIcon(idea.platform);
          return (
            <div
              key={idea.id}
              className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0">
                    <PlatformIcon className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
                  </div>
                  <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                    {idea.platform}
                  </span>
                </div>
                <StatusBadge type={confidenceBadgeType(idea.confidence)}>
                  {idea.confidence}
                </StatusBadge>
              </div>

              {/* Title & Hook */}
              <div className="text-[13px] font-semibold text-foreground leading-tight">{idea.title}</div>
              <p className="text-[12px] text-foreground-secondary mt-1 leading-relaxed">{idea.hook}</p>

              {/* Why it works */}
              <div className="mt-3 pt-3 border-t border-divider">
                <div className="flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 text-accent mt-0.5 shrink-0" strokeWidth={2} />
                  <p className="text-[11px] text-foreground-tertiary leading-relaxed">
                    <span className="font-semibold text-foreground-secondary">Why it will work: </span>
                    {idea.whyItWorks}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Snapshot");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleRunAnalysis = useCallback(async () => {
    const platform = window.prompt("Platform to analyse:", "instagram");
    if (!platform) return;

    const username = window.prompt("Username (without @):", "creativenexusglobal");
    if (!username) return;

    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/social/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          username,
          postsCount: 30,
        }),
      });

      const json: { data?: AnalysisResults; error?: string } = await response.json();

      if (!response.ok || json.error) {
        throw new Error(json.error ?? `Request failed with status ${response.status}`);
      }

      if (json.data) {
        setAnalysisResults(json.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Derive display data from API results or fall back to mock data
  // -------------------------------------------------------------------------

  const analysis = analysisResults?.analysis;

  // Snapshot tab data
  const metricCards: MetricCard[] = analysis
    ? [
        {
          label: "Total Posts Analysed",
          value: String(analysis.performanceSnapshot.totalPosts),
          icon: BarChart3,
        },
        {
          label: "Avg Engagement Rate",
          value: `${analysis.performanceSnapshot.avgEngagement.toLocaleString()}`,
          icon: Heart,
        },
        {
          label: "Top Platform",
          value: analysisResults.platform.charAt(0).toUpperCase() + analysisResults.platform.slice(1),
          icon: Camera,
        },
        {
          label: "Content Health Score",
          value: `${Math.min(100, Math.round(analysis.performanceSnapshot.avgEngagement * 10))}/100`,
          icon: Activity,
        },
      ]
    : defaultMetricCards;

  const topPosts: TopPost[] = analysis
    ? analysis.performanceSnapshot.topPosts.map((post, i) => ({
        id: `live-${i}`,
        platform: (analysisResults.platform.charAt(0).toUpperCase() + analysisResults.platform.slice(1)) as Platform,
        caption: post.caption,
        engagement: post.engagement,
        type: "Reel" as const,
      }))
    : defaultTopPosts;

  const platformEngagement: PlatformEngagement[] = defaultPlatformEngagement;

  // Patterns tab data
  const winningPatterns: PatternCard[] = analysis
    ? analysis.contentPatterns.winningHooks.slice(0, 3).map((hook, i) => ({
        id: `wh-${i}`,
        title: hook.length > 40 ? hook.slice(0, 40) + "..." : hook,
        description: hook,
        dataPoint: analysis.contentPatterns.bestPostTypes[i]
          ? `${analysis.contentPatterns.bestPostTypes[i].type}: ${analysis.contentPatterns.bestPostTypes[i].avgEngagement} avg`
          : "Winning pattern",
        icon: MessageSquare,
      }))
    : defaultWinningPatterns;

  const avoidPatterns: PatternCard[] = defaultAvoidPatterns;

  const hashtagGroups: HashtagGroup[] = analysis
    ? [
        {
          label: "Keep Using",
          color: "bg-success/10",
          textColor: "text-success",
          tags: analysis.hashtagIntelligence.keep.map((t) =>
            t.startsWith("#") ? t : `#${t}`,
          ),
        },
        {
          label: "Stop Using",
          color: "bg-destructive/10",
          textColor: "text-destructive",
          tags: analysis.hashtagIntelligence.stop.map((t) =>
            t.startsWith("#") ? t : `#${t}`,
          ),
        },
        {
          label: "Try These",
          color: "bg-accent/10",
          textColor: "text-accent",
          tags: analysis.hashtagIntelligence.try.map((t) =>
            t.startsWith("#") ? t : `#${t}`,
          ),
        },
      ]
    : defaultHashtagGroups;

  // Ideas tab data
  const contentIdeas: ContentIdea[] = analysis
    ? analysis.contentIdeas.map((idea, i) => ({
        id: `live-idea-${i}`,
        title: idea.format,
        hook: idea.hook,
        whyItWorks: idea.rationale,
        platform: (analysisResults.platform.charAt(0).toUpperCase() + analysisResults.platform.slice(1)) as Platform,
        confidence: (i < 4 ? "High" : "Medium") as "High" | "Medium",
      }))
    : defaultContentIdeas;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Social Intelligence"
        description="Analyse your social media performance, discover winning patterns, and get data-backed content ideas."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRunAnalysis}
              disabled={analysisLoading}
              className="bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
              size="sm"
            >
              {analysisLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" data-icon="inline-start" />
              ) : (
                <Microscope className="w-3.5 h-3.5" data-icon="inline-start" />
              )}
              {analysisLoading ? "Analysing..." : "Run Analysis"}
            </Button>
            <SegmentedControl
              options={[...tabs]}
              value={activeTab}
              onChange={(v) => setActiveTab(v as Tab)}
            />
          </div>
        }
      />

      {/* Analysis Error */}
      {analysisError && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
          <span>{analysisError}</span>
        </div>
      )}

      {activeTab === "Snapshot" && (
        <SnapshotTab
          metricCards={metricCards}
          topPosts={topPosts}
          platformEngagement={platformEngagement}
          analysisLoading={analysisLoading}
        />
      )}
      {activeTab === "Patterns" && (
        <PatternsTab
          winningPatterns={winningPatterns}
          avoidPatterns={avoidPatterns}
          hashtagGroups={hashtagGroups}
        />
      )}
      {activeTab === "Ideas" && <IdeasTab contentIdeas={contentIdeas} />}
    </div>
  );
}
