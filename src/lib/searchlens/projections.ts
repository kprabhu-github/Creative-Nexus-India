// Shared projection helpers for SearchLens API routes.
// Used by /api/searchlens/history and /api/searchlens/scans/[scanId]/[slice]
// to keep the page view-model normalisation in one place.

import type { SupabaseClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/*  Public types — must match ScanResults in /searchlens/page.tsx     */
/* ------------------------------------------------------------------ */

export type PlatformKey =
  | "chatgpt"
  | "gemini"
  | "perplexity"
  | "ai-overviews"
  | "copilot"
  | "claude";

export type Position = "prominent" | "passing" | "absent";
export type Sentiment = "positive" | "neutral" | "negative";
export type InsightCategory = "Content" | "Technical" | "Authority" | "Competitive";
export type Priority = "critical" | "high" | "medium" | "low";

export interface CitationProjection {
  id: string;
  platform: PlatformKey;
  prompt: string;
  position: Position;
  context: string;
  sentiment: Sentiment;
  authority: number;
  sources: string[];
  date: string;
}

export interface InsightProjection {
  id: string;
  priority: Priority;
  title: string;
  description: string;
  action: string;
  category: InsightCategory;
  targetModule: string;
}

export interface PromptProjection {
  id: string;
  prompt: string;
  score: number;
  platforms: Record<string, boolean>;
  competitorCount: number;
  lastChecked: string;
  trendData: number[];
}

export interface CompetitorProjection {
  name: string;
  mentionCount: number;
  promptsAppearedIn: string[];
}

/* ------------------------------------------------------------------ */
/*  Raw row types from Supabase                                        */
/* ------------------------------------------------------------------ */

export interface CitationRow {
  id: string;
  platform: string | null;
  prompt: string | null;
  position: string | null;
  context: string | null;
  sentiment: string | null;
  authority_score: number | null;
  citation_url: string | null;
  scanned_at: string | null;
}

export interface PromptScoreRow {
  prompt: string | null;
  score: number | null;
  scanned_at: string | null;
}

export interface RawInsight {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  actionItem?: string;
}

export interface RawCompetitor {
  name: string;
  mentions?: number;
  score?: number;
}

export interface ScanRow {
  id: string;
  brand_name: string | null;
  visibility_score: number | null;
  citation_count: number | null;
  share_of_voice: number | null;
  recommendation_rate: number | null;
  citation_authority: number | null;
  sentiment: { positive?: number; neutral?: number; negative?: number } | null;
  platform_breakdown: Record<string, { score?: number; mentions?: number }> | null;
  prompt_gaps: string[] | null;
  competitor_comparison: RawCompetitor[] | null;
  insights: RawInsight[] | null;
  scanned_at: string | null;
  created_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  Normalisation helpers                                              */
/* ------------------------------------------------------------------ */

export const VALID_PLATFORM_KEYS: PlatformKey[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "ai-overviews",
  "copilot",
  "claude",
];

export const normPlatform = (raw: string | null | undefined): PlatformKey => {
  const lower = (raw ?? "").toLowerCase().replace(/_/g, "-");
  return (VALID_PLATFORM_KEYS as string[]).includes(lower)
    ? (lower as PlatformKey)
    : "chatgpt";
};

export const normPosition = (raw: string | null | undefined): Position =>
  raw === "prominent" || raw === "passing" || raw === "absent" ? raw : "absent";

export const normSentiment = (raw: string | null | undefined): Sentiment =>
  raw === "positive" || raw === "negative" ? raw : "neutral";

export const normPriority = (raw: string | undefined): Priority =>
  raw === "critical" || raw === "high" || raw === "low" ? raw : "medium";

export const normCategory = (raw: string | undefined): InsightCategory => {
  const lower = (raw ?? "").toLowerCase();
  if (lower === "technical") return "Technical";
  if (lower === "authority") return "Authority";
  if (lower === "competitive") return "Competitive";
  return "Content";
};

export const targetModule = (c: InsightCategory): string =>
  c === "Technical"
    ? "site-audit"
    : c === "Authority"
      ? "nexus-flow"
      : c === "Competitive"
        ? "signal"
        : "gtm";

export const safeHostname = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Row → projection mappers                                           */
/* ------------------------------------------------------------------ */

export function projectCitation(c: CitationRow, scanFallbackDate: string): CitationProjection {
  const host = safeHostname(c.citation_url);
  return {
    id: c.id,
    platform: normPlatform(c.platform),
    prompt: c.prompt ?? "",
    position: normPosition(c.position),
    context: c.context ?? "",
    sentiment: normSentiment(c.sentiment),
    authority: c.authority_score ?? 0,
    sources: host ? [host] : [],
    date: c.scanned_at ?? scanFallbackDate,
  };
}

export function projectInsight(ins: RawInsight, idx: number): InsightProjection {
  const category = normCategory(ins.category);
  return {
    id: `i-${idx}`,
    priority: normPriority(ins.priority),
    title: ins.title ?? "Untitled insight",
    description: ins.description ?? "",
    action: ins.actionItem ?? "",
    category,
    targetModule: targetModule(category),
  };
}

export function projectCompetitor(c: RawCompetitor): CompetitorProjection {
  return {
    name: c.name,
    mentionCount: c.mentions ?? 0,
    promptsAppearedIn: [],
  };
}

/* Build the per-prompt platform-coverage map from citation rows. */
export function buildPlatformMap(rows: CitationRow[]): Map<string, Record<string, boolean>> {
  const platformMap = new Map<string, Record<string, boolean>>();
  for (const c of rows) {
    const k = c.prompt ?? "";
    if (!k) continue;
    const existing =
      platformMap.get(k) ??
      Object.fromEntries(VALID_PLATFORM_KEYS.map((p) => [p, false]));
    if (normPosition(c.position) !== "absent") {
      existing[normPlatform(c.platform)] = true;
    }
    platformMap.set(k, existing);
  }
  return platformMap;
}

/* Build per-prompt score trend buckets (last 7 chronological scores). */
export function buildTrendBuckets(rows: PromptScoreRow[]): Map<string, number[]> {
  const trendBuckets = new Map<string, PromptScoreRow[]>();
  for (const row of rows) {
    if (!row.prompt) continue;
    const arr = trendBuckets.get(row.prompt) ?? [];
    arr.push(row);
    trendBuckets.set(row.prompt, arr);
  }
  // Convert each prompt's row list (already sorted DESC by scanned_at) into
  // an ascending array of last 7 numeric scores.
  const out = new Map<string, number[]>();
  trendBuckets.forEach((list, prompt) => {
    out.set(
      prompt,
      list.slice(0, 7).reverse().map((r: PromptScoreRow) => r.score ?? 0),
    );
  });
  return out;
}

export function projectPrompts(
  promptList: string[],
  platformMap: Map<string, Record<string, boolean>>,
  trendData: Map<string, number[]>,
  lastChecked: string,
): PromptProjection[] {
  return promptList.map((p, idx) => {
    const trend = trendData.get(p) ?? [];
    const score = trend.length > 0 ? trend[trend.length - 1] : 0;
    const platforms =
      platformMap.get(p) ??
      Object.fromEntries(VALID_PLATFORM_KEYS.map((k) => [k, false]));
    return {
      id: `p-${idx}`,
      prompt: p,
      score,
      platforms,
      competitorCount: 0,
      lastChecked,
      trendData: trend,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Citation fetcher — used by both history and slice endpoints       */
/* ------------------------------------------------------------------ */

export async function fetchCitationRows(
  supabase: SupabaseClient,
  scanId: string,
): Promise<{ rows: CitationRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("ais_citations")
    .select(
      "id, platform, prompt, position, context, sentiment, authority_score, citation_url, scanned_at",
    )
    .eq("scan_id", scanId);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CitationRow[], error: null };
}
