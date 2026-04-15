"use client";

import { useState } from "react";
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
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

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
// Mock data
// ---------------------------------------------------------------------------

const metricCards: MetricCard[] = [
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

const topPosts: TopPost[] = [
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

const platformEngagement: PlatformEngagement[] = [
  { platform: "Instagram", icon: Camera, avgEngagement: "6.2%", trend: "up", trendDelta: "+1.1%" },
  { platform: "Twitter", icon: AtSign, avgEngagement: "3.1%", trend: "down", trendDelta: "-0.3%" },
  { platform: "LinkedIn", icon: Send, avgEngagement: "5.4%", trend: "up", trendDelta: "+0.8%" },
  { platform: "TikTok", icon: Music2, avgEngagement: "8.7%", trend: "up", trendDelta: "+2.4%" },
];

const winningPatterns: PatternCard[] = [
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

const avoidPatterns: PatternCard[] = [
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

const hashtagGroups: HashtagGroup[] = [
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

const contentIdeas: ContentIdea[] = [
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

function SnapshotTab() {
  return (
    <div>
      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border"
          >
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

function PatternsTab() {
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

function IdeasTab() {
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Social Intelligence"
        description="Analyse your social media performance, discover winning patterns, and get data-backed content ideas."
        actions={
          <SegmentedControl
            options={[...tabs]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
          />
        }
      />

      {activeTab === "Snapshot" && <SnapshotTab />}
      {activeTab === "Patterns" && <PatternsTab />}
      {activeTab === "Ideas" && <IdeasTab />}
    </div>
  );
}
