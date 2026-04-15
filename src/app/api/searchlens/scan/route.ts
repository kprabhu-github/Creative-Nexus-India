// ---------------------------------------------------------------------------
// POST /api/searchlens/scan — AI SearchLens brand visibility scan
// ---------------------------------------------------------------------------
// Queries AI-generated search results for a brand's visibility across
// user-defined prompts, analyses each result with Claude (research tier),
// calculates an overall visibility score (0-100), and stores results in
// Supabase. Returns a structured breakdown by prompt and competitor.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { ragBrowse } from "@/lib/apify";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ScanInputSchema = z.object({
  brandName: z.string().min(1).max(200),
  prompts: z.array(z.string().min(1).max(1000)).min(1).max(20),
  competitors: z.array(z.string().min(1).max(200)).optional().default([]),
});

// ---------------------------------------------------------------------------
// Analysis system prompt
// ---------------------------------------------------------------------------

const VISIBILITY_ANALYSIS_SYSTEM_PROMPT = `You are an AI visibility analyst. Given search results for a specific prompt, determine the brand's presence and positioning.

Analyse the provided search results and return JSON with this exact shape:
{
  "mentioned": boolean,
  "position": "prominent" | "passing" | "absent",
  "mentionContext": "string describing how/where the brand appears, or empty if absent",
  "competitors_found": ["list of competitor brand names found in results"],
  "sentiment": "positive" | "neutral" | "negative" | "absent",
  "citation_url": "URL where the brand is mentioned, or null",
  "confidence": 0.0 to 1.0
}

Rules:
- "prominent" means the brand is featured as a key recommendation or top result
- "passing" means the brand is mentioned but not as a primary focus
- "absent" means the brand does not appear in any results
- Only list competitors that actually appear in the search results
- Be precise about URLs — only include a citation_url if you can identify the exact source
- Set confidence based on how clearly the results indicate brand presence`;

// ---------------------------------------------------------------------------
// Types for internal processing
// ---------------------------------------------------------------------------

interface PromptAnalysis {
  prompt: string;
  mentioned: boolean;
  position: string;
  mentionContext: string;
  competitorsFound: string[];
  sentiment: string;
  citationUrl: string | null;
  confidence: number;
  searchResultCount: number;
}

interface CompetitorStat {
  name: string;
  mentionCount: number;
  promptsAppearedIn: string[];
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = ScanInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { brandName, prompts, competitors } = parsed.data;
    const supabase = createAdminClient();

    // -----------------------------------------------------------------------
    // Step 1 + 2: For each prompt, search via ragBrowse then analyse with Claude
    // -----------------------------------------------------------------------

    const promptAnalyses: PromptAnalysis[] = [];

    // Process prompts concurrently with a concurrency limit to avoid
    // overwhelming external APIs
    const CONCURRENCY_LIMIT = 3;
    const promptQueue = [...prompts];
    const activePromises: Promise<void>[] = [];

    const processPrompt = async (prompt: string): Promise<void> => {
      // Search for AI-generated results
      let searchResults: Awaited<ReturnType<typeof ragBrowse>>;
      try {
        searchResults = await ragBrowse({
          query: prompt,
          maxResults: 5,
        });
      } catch (searchError) {
        const errorMsg = searchError instanceof Error
          ? searchError.message
          : String(searchError);
        console.error(`Search failed for prompt "${prompt}":`, errorMsg);

        promptAnalyses.push({
          prompt,
          mentioned: false,
          position: "absent",
          mentionContext: `Search failed: ${errorMsg}`,
          competitorsFound: [],
          sentiment: "absent",
          citationUrl: null,
          confidence: 0,
          searchResultCount: 0,
        });
        return;
      }

      if (searchResults.length === 0) {
        promptAnalyses.push({
          prompt,
          mentioned: false,
          position: "absent",
          mentionContext: "No search results returned",
          competitorsFound: [],
          sentiment: "absent",
          citationUrl: null,
          confidence: 0,
          searchResultCount: 0,
        });
        return;
      }

      // Format search results for Claude analysis
      const formattedResults = searchResults
        .map(
          (result, index) =>
            `--- Result ${index + 1} ---\nURL: ${result.url}\nTitle: ${result.title ?? "N/A"}\nContent: ${result.text.slice(0, 2000)}`,
        )
        .join("\n\n");

      const userMessage = [
        `## Brand to search for: "${brandName}"`,
        `## Known competitors: ${competitors.length > 0 ? competitors.join(", ") : "none provided"}`,
        `## Search prompt: "${prompt}"`,
        "",
        "## Search results:",
        formattedResults,
      ].join("\n");

      try {
        const claudeResponse = await callClaude({
          tier: "research",
          systemPrompt: VISIBILITY_ANALYSIS_SYSTEM_PROMPT,
          userMessage,
          maxTokens: 1024,
          temperature: 0.2,
        });

        const analysisResult = parseClaudeJson<{
          mentioned: boolean;
          position: string;
          mentionContext?: string;
          competitors_found: string[];
          sentiment: string;
          citation_url: string | null;
          confidence?: number;
        }>(claudeResponse.text);

        promptAnalyses.push({
          prompt,
          mentioned: analysisResult.mentioned,
          position: analysisResult.position,
          mentionContext: analysisResult.mentionContext ?? "",
          competitorsFound: analysisResult.competitors_found,
          sentiment: analysisResult.sentiment,
          citationUrl: analysisResult.citation_url,
          confidence: analysisResult.confidence ?? 0.5,
          searchResultCount: searchResults.length,
        });
      } catch (analyseError) {
        const errorMsg = analyseError instanceof Error
          ? analyseError.message
          : String(analyseError);
        console.error(`Analysis failed for prompt "${prompt}":`, errorMsg);

        promptAnalyses.push({
          prompt,
          mentioned: false,
          position: "absent",
          mentionContext: `Analysis failed: ${errorMsg}`,
          competitorsFound: [],
          sentiment: "absent",
          citationUrl: null,
          confidence: 0,
          searchResultCount: searchResults.length,
        });
      }
    }

    // Execute with concurrency control
    for (const prompt of promptQueue) {
      const promise = processPrompt(prompt).then(() => {
        const idx = activePromises.indexOf(promise);
        if (idx !== -1) activePromises.splice(idx, 1);
      });
      activePromises.push(promise);

      if (activePromises.length >= CONCURRENCY_LIMIT) {
        await Promise.race(activePromises);
      }
    }
    // Wait for remaining in-flight requests
    await Promise.all(activePromises);

    // -----------------------------------------------------------------------
    // Step 3: Calculate overall visibility score (0-100)
    // -----------------------------------------------------------------------

    const totalPrompts = promptAnalyses.length;
    if (totalPrompts === 0) {
      return NextResponse.json(
        { error: "No prompts could be processed" },
        { status: 500 },
      );
    }

    // Scoring formula:
    //   - Each prompt contributes equally to the total score
    //   - "prominent" mention = full weight, "passing" = half weight, "absent" = 0
    //   - Weighted by confidence
    let rawScore = 0;
    for (const analysis of promptAnalyses) {
      let positionWeight = 0;
      if (analysis.position === "prominent") positionWeight = 1.0;
      else if (analysis.position === "passing") positionWeight = 0.5;

      rawScore += positionWeight * analysis.confidence;
    }
    const visibilityScore = Math.round((rawScore / totalPrompts) * 100);

    // -----------------------------------------------------------------------
    // Build platform breakdown and prompt gaps
    // -----------------------------------------------------------------------

    const platformBreakdown = promptAnalyses.map((analysis) => ({
      prompt: analysis.prompt,
      mentioned: analysis.mentioned,
      position: analysis.position,
      sentiment: analysis.sentiment,
      citationUrl: analysis.citationUrl,
      searchResultCount: analysis.searchResultCount,
    }));

    const promptGaps = promptAnalyses
      .filter((a) => !a.mentioned)
      .map((a) => a.prompt);

    // -----------------------------------------------------------------------
    // Build competitor comparison
    // -----------------------------------------------------------------------

    const competitorMap = new Map<string, CompetitorStat>();

    for (const analysis of promptAnalyses) {
      for (const comp of analysis.competitorsFound) {
        const normalised = comp.toLowerCase().trim();
        const existing = competitorMap.get(normalised);
        if (existing) {
          existing.mentionCount += 1;
          existing.promptsAppearedIn.push(analysis.prompt);
        } else {
          competitorMap.set(normalised, {
            name: comp,
            mentionCount: 1,
            promptsAppearedIn: [analysis.prompt],
          });
        }
      }
    }

    const competitorComparison = Array.from(competitorMap.values())
      .sort((a, b) => b.mentionCount - a.mentionCount);

    // -----------------------------------------------------------------------
    // Step 4: Store visibility scores in ais_visibility_scores
    // -----------------------------------------------------------------------

    const visibilityRows = promptAnalyses.map((analysis) => ({
      org_id: DEFAULT_ORG_ID,
      brand_name: brandName,
      prompt: analysis.prompt,
      mentioned: analysis.mentioned,
      position: analysis.position,
      mention_context: analysis.mentionContext,
      sentiment: analysis.sentiment,
      citation_url: analysis.citationUrl,
      confidence: analysis.confidence,
      visibility_score: analysis.mentioned
        ? analysis.position === "prominent"
          ? Math.round(analysis.confidence * 100)
          : Math.round(analysis.confidence * 50)
        : 0,
      scanned_at: new Date().toISOString(),
    }));

    const { error: visibilityError } = await supabase
      .from("ais_visibility_scores")
      .insert(visibilityRows);

    if (visibilityError) {
      console.error(
        "Failed to store visibility scores:",
        visibilityError.message,
      );
      // Non-fatal: still return results
    }

    // -----------------------------------------------------------------------
    // Step 5: Store competitor data in ais_competitors
    // -----------------------------------------------------------------------

    if (competitorComparison.length > 0) {
      const competitorRows = competitorComparison.map((comp) => ({
        org_id: DEFAULT_ORG_ID,
        brand_name: brandName,
        competitor_name: comp.name,
        mention_count: comp.mentionCount,
        prompts_appeared_in: comp.promptsAppearedIn,
        scanned_at: new Date().toISOString(),
      }));

      const { error: competitorError } = await supabase
        .from("ais_competitors")
        .insert(competitorRows);

      if (competitorError) {
        console.error(
          "Failed to store competitor data:",
          competitorError.message,
        );
        // Non-fatal
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Return structured response
    // -----------------------------------------------------------------------

    return NextResponse.json({
      data: {
        brandName,
        visibilityScore,
        totalPromptsScanned: totalPrompts,
        mentionedIn: promptAnalyses.filter((a) => a.mentioned).length,
        platformBreakdown,
        promptGaps,
        competitorComparison,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/searchlens/scan error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
