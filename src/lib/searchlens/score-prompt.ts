// scoreSinglePrompt — single-prompt scorer extracted from scan-pro/route.ts.
// Runs ragBrowse + Claude analysis per (prompt, platform) pair, aggregates a
// 0-100 visibility score, and optionally writes ais_citations rows. Skips
// share_of_voice / prompt_gaps / competitor_comparison / insights / ais_scans
// (those are scan-pro batch concepts). Caller owns ais_prompt_scores writes.

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { ragBrowse } from "@/lib/apify";

export type PlatformKey = "chatgpt" | "gemini" | "perplexity" | "ai_overviews" | "copilot" | "claude";

export const ALL_PLATFORMS: readonly PlatformKey[] = [
  "chatgpt", "gemini", "perplexity", "ai_overviews", "copilot", "claude",
] as const;

const PLATFORM_QUERY_TEMPLATES: Record<PlatformKey, (prompt: string) => string> = {
  chatgpt: (p) => `"ChatGPT recommends" OR "according to ChatGPT" ${p}`,
  gemini: (p) => `"Gemini suggests" OR "Google AI" ${p}`,
  perplexity: (p) => `site:perplexity.ai ${p}`,
  ai_overviews: (p) => `"AI Overview" ${p}`,
  copilot: (p) => `"Copilot recommends" OR "Microsoft Copilot" ${p}`,
  claude: (p) => `"Claude suggests" OR "Anthropic" ${p}`,
};

const CITATION_ANALYSIS_SYSTEM_PROMPT = `You are an AI visibility analyst. Given search results for a specific prompt on a specific AI platform, determine the brand's presence and positioning. Return JSON with this exact shape:
{ "mentioned": boolean, "position": "prominent"|"passing"|"absent", "context": "snippet or null", "sentiment": "positive"|"neutral"|"negative", "confidence": 0.0-1.0, "citationUrl": "URL or null", "competitorsFound": ["..."], "authorityScore": 0-100 }
Rules: "prominent" = key recommendation; "passing" = mentioned but not primary; "absent" = not in results. Only list competitors actually present. Only include citationUrl if you can identify the exact source. authorityScore: official docs/major pubs 80-100, niche blogs 40-60, forums/social 10-40. If absent, sentiment="neutral", confidence may be >0, authorityScore reflects source quality regardless.`;

interface PairResult {
  platform: PlatformKey;
  mentioned: boolean;
  position: "prominent" | "passing" | "absent";
  context: string | null;
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  citationUrl: string | null;
  competitorsFound: string[];
  authorityScore: number;
  searchResultCount: number;
}

function clampNumber(value: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalisePosition(value: string): "prominent" | "passing" | "absent" {
  const lower = (value ?? "").toLowerCase().trim();
  if (lower === "prominent" || lower === "passing") return lower;
  return "absent";
}

function normaliseSentiment(value: string): "positive" | "neutral" | "negative" {
  const lower = (value ?? "").toLowerCase().trim();
  if (lower === "positive" || lower === "negative") return lower;
  return "neutral";
}

function buildAbsentResult(platform: PlatformKey, searchResultCount = 0): PairResult {
  return {
    platform, mentioned: false, position: "absent", context: null,
    sentiment: "neutral", confidence: 0, citationUrl: null,
    competitorsFound: [], authorityScore: 0, searchResultCount,
  };
}

interface ClaudeAnalysis {
  mentioned: boolean; position: string; context: string | null;
  sentiment: string; confidence: number; citationUrl: string | null;
  competitorsFound: string[]; authorityScore: number;
}

async function analysePair(
  brandName: string, competitors: string[], prompt: string, platform: PlatformKey,
): Promise<PairResult> {
  const searchQuery = PLATFORM_QUERY_TEMPLATES[platform](prompt);

  let searchResults: Awaited<ReturnType<typeof ragBrowse>>;
  try {
    searchResults = await ragBrowse({ query: searchQuery, maxResults: 5 });
  } catch (searchError) {
    const msg = searchError instanceof Error ? searchError.message : String(searchError);
    console.error(`[score-prompt] ragBrowse failed [${platform}] "${prompt}":`, msg);
    return buildAbsentResult(platform);
  }

  if (searchResults.length === 0) return buildAbsentResult(platform, 0);

  const formattedResults = searchResults
    .map((r, i) => `--- Result ${i + 1} ---\nURL: ${r.url}\nTitle: ${r.title ?? "N/A"}\nContent: ${r.text.slice(0, 2000)}`)
    .join("\n\n");

  const userMessage = [
    `## Brand to search for: "${brandName}"`,
    `## Known competitors: ${competitors.length > 0 ? competitors.join(", ") : "none provided"}`,
    `## AI Platform: ${platform}`,
    `## Search prompt: "${prompt}"`,
    "",
    "## Search results:",
    formattedResults,
  ].join("\n");

  try {
    const claudeResponse = await callClaude({
      tier: "research",
      systemPrompt: CITATION_ANALYSIS_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1024,
      temperature: 0.2,
    });

    const analysis = parseClaudeJson<ClaudeAnalysis>(claudeResponse.text);

    return {
      platform,
      mentioned: Boolean(analysis.mentioned),
      position: normalisePosition(analysis.position),
      context: analysis.context ?? null,
      sentiment: normaliseSentiment(analysis.sentiment),
      confidence: clampNumber(analysis.confidence, 0, 1),
      citationUrl: analysis.citationUrl ?? null,
      competitorsFound: Array.isArray(analysis.competitorsFound) ? analysis.competitorsFound : [],
      authorityScore: clampNumber(analysis.authorityScore, 0, 100),
      searchResultCount: searchResults.length,
    };
  } catch (analyseError) {
    const msg = analyseError instanceof Error ? analyseError.message : String(analyseError);
    console.error(`[score-prompt] Claude analysis failed [${platform}] "${prompt}":`, msg);
    return buildAbsentResult(platform, searchResults.length);
  }
}

function aggregateScore(pairs: PairResult[]): number {
  if (pairs.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of pairs) {
    const confidence = Math.max(c.confidence, 0.01);
    let positionValue = 0;
    if (c.position === "prominent") positionValue = 100;
    else if (c.position === "passing") positionValue = 50;
    weightedSum += positionValue * confidence;
    totalWeight += confidence;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export interface ScoreSinglePromptArgs {
  prompt: string;
  brandName: string;
  competitors?: string[];
  platforms?: PlatformKey[];
  orgId?: string;
  /** When true, write each pair to ais_citations for audit. Defaults to true. */
  persistCitations?: boolean;
}

export interface ScoreSinglePromptResult {
  score: number;
  perPlatform: Record<PlatformKey, { mentioned: boolean; position: string }>;
  citationsInserted: number;
  platformsChecked: PlatformKey[];
  averageConfidence: number;
}

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

/** Score a single prompt across the given AI platforms. Returns aggregate
 * visibility (0-100), per-platform breakdown, and ais_citations rows written. */
export async function scoreSinglePrompt(args: ScoreSinglePromptArgs): Promise<ScoreSinglePromptResult> {
  const platforms = args.platforms ?? [...ALL_PLATFORMS];
  const competitors = args.competitors ?? [];
  const orgId = args.orgId ?? DEFAULT_ORG_ID;
  const persistCitations = args.persistCitations ?? true;

  const pairs = await Promise.all(
    platforms.map((platform) => analysePair(args.brandName, competitors, args.prompt, platform)),
  );

  const score = aggregateScore(pairs);

  const perPlatform: Record<string, { mentioned: boolean; position: string }> = {};
  for (const p of pairs) perPlatform[p.platform] = { mentioned: p.mentioned, position: p.position };

  const averageConfidence =
    pairs.length > 0
      ? Math.round((pairs.reduce((a, p) => a + p.confidence, 0) / pairs.length) * 100) / 100
      : 0;

  let citationsInserted = 0;
  if (persistCitations && pairs.length > 0) {
    try {
      const supabase = createAdminClient();
      const rows = pairs.map((c) => ({
        org_id: orgId, scan_id: null, brand_name: args.brandName,
        platform: c.platform, prompt: args.prompt, mentioned: c.mentioned,
        position: c.position, context: c.context, sentiment: c.sentiment,
        confidence: c.confidence, citation_url: c.citationUrl,
        competitors_found: c.competitorsFound, authority_score: c.authorityScore,
        search_result_count: c.searchResultCount, scanned_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("ais_citations").insert(rows);
      if (error) console.error("[score-prompt] failed to insert ais_citations:", error.message);
      else citationsInserted = rows.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[score-prompt] ais_citations insert threw:", msg);
    }
  }

  return {
    score,
    perPlatform: perPlatform as Record<PlatformKey, { mentioned: boolean; position: string }>,
    citationsInserted,
    platformsChecked: platforms,
    averageConfidence,
  };
}
