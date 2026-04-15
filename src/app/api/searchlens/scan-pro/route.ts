// ---------------------------------------------------------------------------
// POST /api/searchlens/scan-pro — AI SearchLens Pro multi-platform scan
// ---------------------------------------------------------------------------
// Enhanced version of the basic scan. Queries AI-generated search results
// across 6 AI platforms (ChatGPT, Gemini, Perplexity, AI Overviews,
// Copilot, Claude) for each user-defined prompt. Analyses each
// prompt x platform pair with Claude, calculates aggregate metrics
// (visibility score, share of voice, recommendation rate, citation
// authority, sentiment breakdown, prompt gaps), generates strategic
// insights, and stores everything in Supabase.
//
// Tables written: ais_scans, ais_citations, ais_prompt_scores,
//                 ais_trending_prompts
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { ragBrowse } from "@/lib/apify";
import { createNotification } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

/** Maximum parallel prompt x platform tasks to run concurrently. */
const CONCURRENCY_LIMIT = 2;

// ---------------------------------------------------------------------------
// Supported AI platforms and their search query templates
// ---------------------------------------------------------------------------

const PLATFORM_QUERY_TEMPLATES: Record<string, (prompt: string) => string> = {
  chatgpt: (p) => `"ChatGPT recommends" OR "according to ChatGPT" ${p}`,
  gemini: (p) => `"Gemini suggests" OR "Google AI" ${p}`,
  perplexity: (p) => `site:perplexity.ai ${p}`,
  ai_overviews: (p) => `"AI Overview" ${p}`,
  copilot: (p) => `"Copilot recommends" OR "Microsoft Copilot" ${p}`,
  claude: (p) => `"Claude suggests" OR "Anthropic" ${p}`,
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ScanProInputSchema = z.object({
  brandName: z.string().min(1).max(200),
  prompts: z.array(z.string().min(1).max(1000)).min(1).max(20),
  competitors: z.array(z.string().min(1).max(200)).optional().default([]),
  platforms: z
    .array(z.enum(["chatgpt", "gemini", "perplexity", "ai_overviews", "copilot", "claude"]))
    .min(1)
    .max(6)
    .optional()
    .default(["chatgpt", "gemini", "perplexity", "ai_overviews", "copilot", "claude"]),
});

// ---------------------------------------------------------------------------
// Analysis system prompts
// ---------------------------------------------------------------------------

const CITATION_ANALYSIS_SYSTEM_PROMPT = `You are an AI visibility analyst. Given search results for a specific prompt on a specific AI platform, determine the brand's presence and positioning.

Analyse the provided search results and return JSON with this exact shape:
{
  "mentioned": boolean,
  "position": "prominent" | "passing" | "absent",
  "context": "exact text snippet where brand appears, or null if absent",
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": 0.0 to 1.0,
  "citationUrl": "URL where the brand is mentioned, or null",
  "competitorsFound": ["list of competitor brand names found in results"],
  "authorityScore": 0 to 100
}

Rules:
- "prominent" means the brand is featured as a key recommendation or highlighted result
- "passing" means the brand is mentioned but not as a primary focus
- "absent" means the brand does not appear in any results
- Only list competitors that actually appear in the search results
- Be precise about URLs — only include a citationUrl if you can identify the exact source
- Set confidence based on how clearly the results indicate brand presence
- authorityScore: rate the source quality 0-100 based on domain authority, publication reputation, and content depth. Official documentation or major publications = 80-100, niche blogs = 40-60, forums/social = 10-40
- If brand is absent, sentiment should still be "neutral" (not absent), confidence can be >0 if you are confident it is absent, and authorityScore should reflect source quality regardless`;

const INSIGHTS_SYSTEM_PROMPT = `You are an AI search strategist. Given the visibility scan results for a brand across multiple AI platforms, generate 5-7 actionable insights.

Each insight must have:
- "title": concise insight title (max 80 chars)
- "description": detailed explanation (2-3 sentences)
- "priority": "critical" | "high" | "medium" | "low"
- "category": "content" | "technical" | "authority" | "competitive"
- "actionItem": a specific, immediately actionable next step

Focus on:
1. Prompt gaps where competitors appear but the brand does not
2. Citation building opportunities from high-authority sources
3. Content optimisation for AI readability and structured data
4. Schema markup improvements that help AI systems parse brand info
5. Competitive weaknesses to exploit (platforms/prompts where competitors are weak)
6. Platform-specific strategies (e.g. Perplexity citation patterns differ from ChatGPT)

Return a JSON array of insight objects. Prioritise insights by impact potential.`;

// ---------------------------------------------------------------------------
// Types for internal processing
// ---------------------------------------------------------------------------

interface CitationResult {
  platform: string;
  prompt: string;
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

interface PlatformScore {
  score: number;
  mentions: number;
  totalChecked: number;
}

interface CompetitorScore {
  name: string;
  score: number;
  mentions: number;
}

interface Insight {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "content" | "technical" | "authority" | "competitive";
  actionItem: string;
}

interface ScanProResponse {
  scanId: string;
  visibilityScore: number;
  citationCount: number;
  shareOfVoice: number;
  recommendationRate: number;
  citationAuthority: number;
  sentiment: { positive: number; neutral: number; negative: number };
  platformBreakdown: Record<string, PlatformScore>;
  promptGaps: string[];
  competitorComparison: CompetitorScore[];
  citations: CitationResult[];
  insights: Insight[];
  totalPromptsScanned: number;
  totalPlatformsChecked: number;
  scanDuration: number;
}

// ---------------------------------------------------------------------------
// Concurrency helper — process an array of tasks with a fixed concurrency
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
    });
    const wrapped = p.then(
      () => { executing.delete(wrapped); },
      () => { executing.delete(wrapped); },
    );
    executing.add(wrapped);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// ---------------------------------------------------------------------------
// Core: analyse a single prompt x platform pair
// ---------------------------------------------------------------------------

async function analysePair(
  brandName: string,
  competitors: string[],
  prompt: string,
  platform: string,
): Promise<CitationResult> {
  const queryBuilder = PLATFORM_QUERY_TEMPLATES[platform];
  if (!queryBuilder) {
    return buildAbsentResult(platform, prompt, `Unsupported platform: ${platform}`);
  }

  const searchQuery = queryBuilder(prompt);

  // Step 1: Search via ragBrowse
  let searchResults: Awaited<ReturnType<typeof ragBrowse>>;
  try {
    searchResults = await ragBrowse({ query: searchQuery, maxResults: 5 });
  } catch (searchError) {
    const errorMsg =
      searchError instanceof Error ? searchError.message : String(searchError);
    console.error(
      `ragBrowse failed [${platform}] "${prompt}":`,
      errorMsg,
    );
    return buildAbsentResult(platform, prompt, `Search failed: ${errorMsg}`);
  }

  if (searchResults.length === 0) {
    return buildAbsentResult(platform, prompt, null, 0);
  }

  // Step 2: Format results and analyse with Claude Haiku
  const formattedResults = searchResults
    .map(
      (r, i) =>
        `--- Result ${i + 1} ---\nURL: ${r.url}\nTitle: ${r.title ?? "N/A"}\nContent: ${r.text.slice(0, 2000)}`,
    )
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

    const analysis = parseClaudeJson<{
      mentioned: boolean;
      position: string;
      context: string | null;
      sentiment: string;
      confidence: number;
      citationUrl: string | null;
      competitorsFound: string[];
      authorityScore: number;
    }>(claudeResponse.text);

    return {
      platform,
      prompt,
      mentioned: analysis.mentioned,
      position: normalisePosition(analysis.position),
      context: analysis.context ?? null,
      sentiment: normaliseSentiment(analysis.sentiment),
      confidence: clampNumber(analysis.confidence, 0, 1),
      citationUrl: analysis.citationUrl ?? null,
      competitorsFound: Array.isArray(analysis.competitorsFound)
        ? analysis.competitorsFound
        : [],
      authorityScore: clampNumber(analysis.authorityScore, 0, 100),
      searchResultCount: searchResults.length,
    };
  } catch (analyseError) {
    const errorMsg =
      analyseError instanceof Error
        ? analyseError.message
        : String(analyseError);
    console.error(
      `Claude analysis failed [${platform}] "${prompt}":`,
      errorMsg,
    );
    return buildAbsentResult(
      platform,
      prompt,
      `Analysis failed: ${errorMsg}`,
      searchResults.length,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers for safe value normalisation
// ---------------------------------------------------------------------------

function normalisePosition(
  value: string,
): "prominent" | "passing" | "absent" {
  const lower = value.toLowerCase().trim();
  if (lower === "prominent") return "prominent";
  if (lower === "passing") return "passing";
  return "absent";
}

function normaliseSentiment(
  value: string,
): "positive" | "neutral" | "negative" {
  const lower = value.toLowerCase().trim();
  if (lower === "positive") return "positive";
  if (lower === "negative") return "negative";
  return "neutral";
}

function clampNumber(value: number, min: number, max: number): number {
  if (typeof value !== "number" || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function buildAbsentResult(
  platform: string,
  prompt: string,
  context: string | null,
  searchResultCount = 0,
): CitationResult {
  return {
    platform,
    prompt,
    mentioned: false,
    position: "absent",
    context,
    sentiment: "neutral",
    confidence: 0,
    citationUrl: null,
    competitorsFound: [],
    authorityScore: 0,
    searchResultCount,
  };
}

// ---------------------------------------------------------------------------
// Aggregate calculators
// ---------------------------------------------------------------------------

function calculateVisibilityScore(citations: CitationResult[]): number {
  if (citations.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const c of citations) {
    const confidence = Math.max(c.confidence, 0.01); // avoid zero-weight
    let positionValue = 0;
    if (c.position === "prominent") positionValue = 100;
    else if (c.position === "passing") positionValue = 50;

    weightedSum += positionValue * confidence;
    totalWeight += confidence;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function calculateShareOfVoice(
  citations: CitationResult[],
): number {
  let brandMentions = 0;
  let totalMentions = 0;

  for (const c of citations) {
    if (c.mentioned) {
      brandMentions += 1;
    }
    // Count each competitor mention as well
    totalMentions += c.competitorsFound.length;
  }

  // Total mentions = brand mentions + all competitor mentions
  totalMentions += brandMentions;

  if (totalMentions === 0) return 0;
  return Math.round((brandMentions / totalMentions) * 1000) / 10; // one decimal
}

function calculateRecommendationRate(citations: CitationResult[]): number {
  if (citations.length === 0) return 0;

  // Group by prompt — a prompt is "recommended" if it is prominent on any platform
  const promptMap = new Map<string, boolean>();
  for (const c of citations) {
    const current = promptMap.get(c.prompt) ?? false;
    if (c.position === "prominent") {
      promptMap.set(c.prompt, true);
    } else if (!current) {
      promptMap.set(c.prompt, false);
    }
  }

  const totalPrompts = promptMap.size;
  if (totalPrompts === 0) return 0;

  let prominentPrompts = 0;
  Array.from(promptMap.values()).forEach((isProminent) => {
    if (isProminent) prominentPrompts += 1;
  });

  return Math.round((prominentPrompts / totalPrompts) * 1000) / 10;
}

function calculateCitationAuthority(citations: CitationResult[]): number {
  const mentionedCitations = citations.filter((c) => c.mentioned);
  if (mentionedCitations.length === 0) return 0;

  const sum = mentionedCitations.reduce(
    (acc, c) => acc + c.authorityScore,
    0,
  );
  return Math.round(sum / mentionedCitations.length);
}

function calculateSentimentBreakdown(
  citations: CitationResult[],
): { positive: number; neutral: number; negative: number } {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const c of citations) {
    if (c.mentioned) {
      counts[c.sentiment] += 1;
    }
  }
  return counts;
}

function calculatePlatformBreakdown(
  citations: CitationResult[],
  platforms: string[],
): Record<string, PlatformScore> {
  const result: Record<string, PlatformScore> = {};

  for (const platform of platforms) {
    const platformCitations = citations.filter(
      (c) => c.platform === platform,
    );
    const mentions = platformCitations.filter((c) => c.mentioned).length;

    // Per-platform visibility score
    const score = calculateVisibilityScore(platformCitations);

    result[platform] = {
      score,
      mentions,
      totalChecked: platformCitations.length,
    };
  }

  return result;
}

function findPromptGaps(
  citations: CitationResult[],
): string[] {
  // Group by prompt
  const promptMap = new Map<
    string,
    { brandMentioned: boolean; competitorsSeen: boolean }
  >();

  for (const c of citations) {
    const existing = promptMap.get(c.prompt) ?? {
      brandMentioned: false,
      competitorsSeen: false,
    };

    if (c.mentioned) existing.brandMentioned = true;
    if (c.competitorsFound.length > 0) existing.competitorsSeen = true;

    promptMap.set(c.prompt, existing);
  }

  const gaps: string[] = [];
  Array.from(promptMap.entries()).forEach(([prompt, data]) => {
    if (!data.brandMentioned && data.competitorsSeen) {
      gaps.push(prompt);
    }
  });

  return gaps;
}

function buildCompetitorComparison(
  citations: CitationResult[],
): CompetitorScore[] {
  const competitorMap = new Map<
    string,
    { name: string; totalScore: number; count: number; mentions: number }
  >();

  for (const c of citations) {
    for (const comp of c.competitorsFound) {
      const key = comp.toLowerCase().trim();
      const existing = competitorMap.get(key);
      if (existing) {
        existing.mentions += 1;
        // Each mention gets a position-based score contribution
        let posScore = 0;
        if (c.position === "prominent") posScore = 100;
        else if (c.position === "passing") posScore = 50;
        existing.totalScore += posScore;
        existing.count += 1;
      } else {
        let posScore = 0;
        if (c.position === "prominent") posScore = 100;
        else if (c.position === "passing") posScore = 50;
        competitorMap.set(key, {
          name: comp,
          totalScore: posScore,
          count: 1,
          mentions: 1,
        });
      }
    }
  }

  return Array.from(competitorMap.values())
    .map((v) => ({
      name: v.name,
      score: v.count > 0 ? Math.round(v.totalScore / v.count) : 0,
      mentions: v.mentions,
    }))
    .sort((a, b) => b.score - a.score || b.mentions - a.mentions);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body: unknown = await request.json();
    const parsed = ScanProInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { brandName, prompts, competitors, platforms } = parsed.data;
    const supabase = createAdminClient();

    // -------------------------------------------------------------------
    // Step 1-2: Build all prompt x platform tasks and execute with
    // concurrency limit of 2
    // -------------------------------------------------------------------

    const tasks: Array<() => Promise<CitationResult>> = [];

    for (const prompt of prompts) {
      for (const platform of platforms) {
        tasks.push(() => analysePair(brandName, competitors, prompt, platform));
      }
    }

    const citations = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);

    if (citations.length === 0) {
      return NextResponse.json(
        { error: "No prompt-platform pairs could be processed" },
        { status: 500 },
      );
    }

    // -------------------------------------------------------------------
    // Step 3: Calculate aggregate metrics
    // -------------------------------------------------------------------

    const visibilityScore = calculateVisibilityScore(citations);
    const citationCount = citations.filter((c) => c.mentioned).length;
    const shareOfVoice = calculateShareOfVoice(citations);
    const recommendationRate = calculateRecommendationRate(citations);
    const citationAuthority = calculateCitationAuthority(citations);
    const sentiment = calculateSentimentBreakdown(citations);
    const platformBreakdown = calculatePlatformBreakdown(citations, platforms);
    const promptGaps = findPromptGaps(citations);
    const competitorComparison = buildCompetitorComparison(citations);

    // -------------------------------------------------------------------
    // Step 4: Generate strategic insights with Claude Sonnet
    // -------------------------------------------------------------------

    let insights: Insight[] = [];

    try {
      const insightsUserMessage = JSON.stringify(
        {
          brandName,
          visibilityScore,
          citationCount,
          shareOfVoice,
          recommendationRate,
          citationAuthority,
          sentiment,
          platformBreakdown,
          promptGaps,
          competitorComparison,
          totalCitations: citations.length,
          mentionedCitations: citations
            .filter((c) => c.mentioned)
            .map((c) => ({
              platform: c.platform,
              prompt: c.prompt,
              position: c.position,
              context: c.context,
              sentiment: c.sentiment,
              authorityScore: c.authorityScore,
            })),
          absentCitations: citations
            .filter((c) => !c.mentioned)
            .map((c) => ({
              platform: c.platform,
              prompt: c.prompt,
              competitorsFound: c.competitorsFound,
            })),
        },
        null,
        2,
      );

      const insightsResponse = await callClaude({
        tier: "execution",
        systemPrompt: INSIGHTS_SYSTEM_PROMPT,
        userMessage: insightsUserMessage,
        maxTokens: 4096,
        temperature: 0.4,
      });

      const parsedInsights = parseClaudeJson<Insight[]>(
        insightsResponse.text,
      );

      if (Array.isArray(parsedInsights)) {
        insights = parsedInsights.map((ins) => ({
          title: String(ins.title ?? "Untitled Insight"),
          description: String(ins.description ?? ""),
          priority: normaliseInsightPriority(ins.priority),
          category: normaliseInsightCategory(ins.category),
          actionItem: String(ins.actionItem ?? ""),
        }));
      }
    } catch (insightError) {
      const errorMsg =
        insightError instanceof Error
          ? insightError.message
          : String(insightError);
      console.error("Insight generation failed:", errorMsg);
      // Non-fatal: return results without insights
    }

    // -------------------------------------------------------------------
    // Step 5: Store the full scan in ais_scans
    // -------------------------------------------------------------------

    const scanDuration = Date.now() - startTime;

    const { data: scanRow, error: scanError } = await supabase
      .from("ais_scans")
      .insert({
        org_id: DEFAULT_ORG_ID,
        brand_name: brandName,
        scan_type: "pro",
        prompts,
        competitors,
        platforms,
        visibility_score: visibilityScore,
        citation_count: citationCount,
        share_of_voice: shareOfVoice,
        recommendation_rate: recommendationRate,
        citation_authority: citationAuthority,
        sentiment,
        platform_breakdown: platformBreakdown,
        prompt_gaps: promptGaps,
        competitor_comparison: competitorComparison,
        insights,
        total_prompts_scanned: prompts.length,
        total_platforms_checked: platforms.length,
        scan_duration_ms: scanDuration,
        scanned_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (scanError) {
      console.error("Failed to store scan:", scanError.message);
    }

    const scanId = (scanRow?.id as string) ?? crypto.randomUUID();

    // -------------------------------------------------------------------
    // Step 5b: Store each citation in ais_citations
    // -------------------------------------------------------------------

    const citationRows = citations.map((c) => ({
      org_id: DEFAULT_ORG_ID,
      scan_id: scanRow?.id ?? null,
      brand_name: brandName,
      platform: c.platform,
      prompt: c.prompt,
      mentioned: c.mentioned,
      position: c.position,
      context: c.context,
      sentiment: c.sentiment,
      confidence: c.confidence,
      citation_url: c.citationUrl,
      competitors_found: c.competitorsFound,
      authority_score: c.authorityScore,
      search_result_count: c.searchResultCount,
      scanned_at: new Date().toISOString(),
    }));

    if (citationRows.length > 0) {
      const { error: citationError } = await supabase
        .from("ais_citations")
        .insert(citationRows);

      if (citationError) {
        console.error(
          "Failed to store citations:",
          citationError.message,
        );
      }
    }

    // -------------------------------------------------------------------
    // Step 6: Store per-prompt scores in ais_prompt_scores
    // -------------------------------------------------------------------

    const promptScoreMap = new Map<
      string,
      { scores: number[]; confidences: number[]; platforms: string[] }
    >();

    for (const c of citations) {
      const existing = promptScoreMap.get(c.prompt) ?? {
        scores: [],
        confidences: [],
        platforms: [],
      };

      let posScore = 0;
      if (c.position === "prominent") posScore = 100;
      else if (c.position === "passing") posScore = 50;

      existing.scores.push(posScore * c.confidence);
      existing.confidences.push(c.confidence);
      existing.platforms.push(c.platform);
      promptScoreMap.set(c.prompt, existing);
    }

    const promptScoreRows = Array.from(promptScoreMap.entries()).map(
      ([prompt, data]) => {
        const avgScore =
          data.scores.length > 0
            ? Math.round(
                data.scores.reduce((a, b) => a + b, 0) /
                  data.scores.length,
              )
            : 0;
        const avgConfidence =
          data.confidences.length > 0
            ? Math.round(
                (data.confidences.reduce((a, b) => a + b, 0) /
                  data.confidences.length) *
                  100,
              ) / 100
            : 0;

        return {
          org_id: DEFAULT_ORG_ID,
          scan_id: scanRow?.id ?? null,
          brand_name: brandName,
          prompt,
          score: avgScore,
          confidence: avgConfidence,
          platforms_checked: data.platforms,
          scanned_at: new Date().toISOString(),
        };
      },
    );

    if (promptScoreRows.length > 0) {
      const { error: promptScoreError } = await supabase
        .from("ais_prompt_scores")
        .insert(promptScoreRows);

      if (promptScoreError) {
        console.error(
          "Failed to store prompt scores:",
          promptScoreError.message,
        );
      }
    }

    // -------------------------------------------------------------------
    // Step 6b: Store in ais_trending_prompts for trend tracking
    // -------------------------------------------------------------------

    const trendingRows = prompts.map((prompt) => ({
      org_id: DEFAULT_ORG_ID,
      brand_name: brandName,
      prompt,
      scan_id: scanRow?.id ?? null,
      visibility_score: calculateVisibilityScore(
        citations.filter((c) => c.prompt === prompt),
      ),
      scanned_at: new Date().toISOString(),
    }));

    if (trendingRows.length > 0) {
      const { error: trendingError } = await supabase
        .from("ais_trending_prompts")
        .insert(trendingRows);

      if (trendingError) {
        console.error(
          "Failed to store trending prompts:",
          trendingError.message,
        );
      }
    }

    // -------------------------------------------------------------------
    // Step 7: Push notification with results summary
    // -------------------------------------------------------------------

    await createNotification({
      title: `SearchLens Pro: ${visibilityScore}/100`,
      message: `AI SearchLens Pro scan for "${brandName}" complete. ${citationCount} citations across ${platforms.length} platforms, ${prompts.length} prompts. Share of voice: ${shareOfVoice}%. ${promptGaps.length > 0 ? `${promptGaps.length} prompt gap(s) detected.` : "No gaps."}`,
      category: "searchlens",
      priority: visibilityScore < 30 ? "critical" : visibilityScore < 50 ? "high" : "medium",
      sourceModule: "searchlens",
      sourceUrl: "/searchlens",
      actions: [{ label: "View Results", url: "/searchlens" }],
    });

    // -------------------------------------------------------------------
    // Step 8: Return structured response
    // -------------------------------------------------------------------

    const response: ScanProResponse = {
      scanId,
      visibilityScore,
      citationCount,
      shareOfVoice,
      recommendationRate,
      citationAuthority,
      sentiment,
      platformBreakdown,
      promptGaps,
      competitorComparison,
      citations,
      insights,
      totalPromptsScanned: prompts.length,
      totalPlatformsChecked: platforms.length,
      scanDuration,
    };

    return NextResponse.json({ data: response });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/searchlens/scan-pro error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Safe normalisers for insight fields
// ---------------------------------------------------------------------------

function normaliseInsightPriority(
  value: unknown,
): "critical" | "high" | "medium" | "low" {
  if (typeof value !== "string") return "medium";
  const lower = value.toLowerCase().trim();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "low") return "low";
  return "medium";
}

function normaliseInsightCategory(
  value: unknown,
): "content" | "technical" | "authority" | "competitive" {
  if (typeof value !== "string") return "content";
  const lower = value.toLowerCase().trim();
  if (lower === "technical") return "technical";
  if (lower === "authority") return "authority";
  if (lower === "competitive") return "competitive";
  return "content";
}
