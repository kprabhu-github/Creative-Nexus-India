// ---------------------------------------------------------------------------
// POST /api/social/analyse — Social Intelligence W12
// ---------------------------------------------------------------------------
// Scrapes a social media account via Apify, stores raw posts and scrape
// metadata in Supabase, then calls Claude (execution tier) to produce a
// structured performance analysis. Returns the analysis JSON.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { scrapeInstagram, ragBrowse } from "@/lib/apify";
import { createNotification } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const AnalyseInputSchema = z.object({
  platform: z.enum(["instagram", "twitter"]),
  username: z.string().min(1).max(200),
  postsCount: z.number().int().min(1).max(200).optional().default(30),
});

// ---------------------------------------------------------------------------
// Types for scraped post data normalisation
// ---------------------------------------------------------------------------

interface NormalisedPost {
  caption: string;
  likes: number;
  comments: number;
  saves: number;
  post_date: string | null;
  hashtags: string[];
  post_type: string;
  engagement_total: number;
  raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Analysis system prompt
// ---------------------------------------------------------------------------

const SOCIAL_ANALYSIS_SYSTEM_PROMPT = `You are a social media performance analyst. Analyse the following social media posts and produce:

1) Performance snapshot:
   - Average engagement rate (total engagements / post count)
   - Top 3 performing posts (by total engagement) with why they worked
   - Bottom 3 performing posts with why they underperformed

2) Content patterns:
   - Winning hooks (first lines / openings that drove high engagement)
   - Best performing post types (carousel, reel, static, thread, etc.)
   - Optimal caption length range based on high-performing posts

3) Hashtag intelligence:
   - "keep" list: hashtags correlated with above-average engagement
   - "stop" list: hashtags correlated with below-average engagement
   - "try" list: suggested new hashtags based on content themes

4) 8 data-backed content ideas:
   - Each with a hook, format recommendation, and expected engagement rationale

Return structured JSON with this exact shape:
{
  "performanceSnapshot": {
    "avgEngagement": 0,
    "totalPosts": 0,
    "topPosts": [{ "caption": "...", "engagement": 0, "reason": "..." }],
    "bottomPosts": [{ "caption": "...", "engagement": 0, "reason": "..." }]
  },
  "contentPatterns": {
    "winningHooks": ["..."],
    "bestPostTypes": [{ "type": "...", "avgEngagement": 0 }],
    "optimalCaptionLength": { "min": 0, "max": 0, "unit": "characters" }
  },
  "hashtagIntelligence": {
    "keep": ["..."],
    "stop": ["..."],
    "try": ["..."]
  },
  "contentIdeas": [
    { "hook": "...", "format": "...", "rationale": "..." }
  ]
}

Be specific and quantitative. Reference actual post data in your analysis. Do not fabricate metrics.`;

// ---------------------------------------------------------------------------
// Helpers: normalise scraped data from different platforms
// ---------------------------------------------------------------------------

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map((tag) => tag.toLowerCase()) : [];
}

function normaliseInstagramPost(raw: Record<string, unknown>): NormalisedPost {
  const caption = (raw.caption as string) ?? "";
  const likes = Number(raw.likesCount ?? raw.likes ?? 0);
  const comments = Number(raw.commentsCount ?? raw.comments ?? 0);
  const saves = Number(raw.savesCount ?? raw.saves ?? 0);
  const engagement_total = likes + comments + saves;

  let post_type = "static";
  if (raw.type === "Video" || raw.videoUrl || raw.isVideo) {
    post_type = "reel";
  } else if (
    raw.type === "Sidecar" ||
    (Array.isArray(raw.images) && (raw.images as unknown[]).length > 1) ||
    (Array.isArray(raw.childPosts) && (raw.childPosts as unknown[]).length > 0)
  ) {
    post_type = "carousel";
  }

  const timestamp = (raw.timestamp as string) ?? (raw.takenAtTimestamp as string) ?? null;
  const post_date = timestamp ? new Date(timestamp).toISOString() : null;

  return {
    caption,
    likes,
    comments,
    saves,
    post_date,
    hashtags: extractHashtags(caption),
    post_type,
    engagement_total,
    raw,
  };
}

function normaliseTwitterPost(raw: Record<string, unknown>): NormalisedPost {
  const caption =
    (raw.full_text as string) ??
    (raw.text as string) ??
    (raw.content as string) ??
    "";
  const likes = Number(
    raw.favorite_count ?? raw.likeCount ?? raw.likes ?? 0,
  );
  const comments = Number(
    raw.reply_count ?? raw.replyCount ?? raw.replies ?? 0,
  );
  const retweets = Number(
    raw.retweet_count ?? raw.retweetCount ?? raw.retweets ?? 0,
  );
  const engagement_total = likes + comments + retweets;

  const createdAt = (raw.created_at as string) ?? (raw.createdAt as string) ?? null;
  const post_date = createdAt ? new Date(createdAt).toISOString() : null;

  let post_type = "tweet";
  if (raw.hasMedia || raw.media || raw.photos) {
    post_type = "media_tweet";
  }
  if (raw.isThread || raw.threadId) {
    post_type = "thread";
  }

  return {
    caption,
    likes,
    comments,
    saves: retweets, // Twitter has no saves; store retweet count in saves column
    post_date,
    hashtags: extractHashtags(caption),
    post_type,
    engagement_total,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = AnalyseInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { platform, username, postsCount } = parsed.data;
    const supabase = createAdminClient();

    // -----------------------------------------------------------------------
    // Step 1: Scrape social account via Apify
    // -----------------------------------------------------------------------

    let rawPosts: Record<string, unknown>[];

    if (platform === "instagram") {
      rawPosts = await scrapeInstagram({
        usernames: [username],
        resultsLimit: postsCount,
      });
    } else {
      // Twitter: use ragBrowse with a targeted search query
      const twitterResults = await ragBrowse({
        query: `from:${username} site:twitter.com OR site:x.com`,
        maxResults: postsCount,
      });
      rawPosts = twitterResults.map((result) => ({
        text: result.text,
        url: result.url,
        title: result.title,
      }));
    }

    if (rawPosts.length === 0) {
      return NextResponse.json(
        { error: `No posts found for @${username} on ${platform}` },
        { status: 404 },
      );
    }

    // -----------------------------------------------------------------------
    // Step 2: Store scrape metadata in sig_social_scrapes
    // -----------------------------------------------------------------------

    const { data: scrapeRecord, error: scrapeError } = await supabase
      .from("sig_social_scrapes")
      .insert({
        org_id: DEFAULT_ORG_ID,
        platform,
        username,
        posts_count: rawPosts.length,
        raw_data: rawPosts,
        scraped_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (scrapeError || !scrapeRecord) {
      console.error("Failed to store scrape record:", scrapeError?.message);
      return NextResponse.json(
        { error: `Failed to store scrape data: ${scrapeError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    const scrapeId = scrapeRecord.id as string;

    // -----------------------------------------------------------------------
    // Step 3: Normalise and store individual posts in sig_social_posts
    // -----------------------------------------------------------------------

    const normalisedPosts: NormalisedPost[] = rawPosts.map((post) =>
      platform === "instagram"
        ? normaliseInstagramPost(post)
        : normaliseTwitterPost(post),
    );

    const postRows = normalisedPosts.map((post) => ({
      org_id: DEFAULT_ORG_ID,
      scrape_id: scrapeId,
      platform,
      username,
      caption: post.caption.slice(0, 5000),
      likes: post.likes,
      comments: post.comments,
      saves: post.saves,
      post_date: post.post_date,
      hashtags: post.hashtags,
      post_type: post.post_type,
      engagement_total: post.engagement_total,
    }));

    const { error: postsError } = await supabase
      .from("sig_social_posts")
      .insert(postRows);

    if (postsError) {
      console.error("Failed to store posts:", postsError.message);
      // Non-fatal: continue with analysis even if individual post storage fails
    }

    // -----------------------------------------------------------------------
    // Step 4: Call Claude (execution tier) for structured analysis
    // -----------------------------------------------------------------------

    const postsForAnalysis = normalisedPosts.map((post) => ({
      caption: post.caption.slice(0, 500),
      likes: post.likes,
      comments: post.comments,
      saves: post.saves,
      post_date: post.post_date,
      hashtags: post.hashtags,
      post_type: post.post_type,
      engagement_total: post.engagement_total,
    }));

    const userMessage = [
      `## Account: @${username} on ${platform}`,
      `## Total posts analysed: ${postsForAnalysis.length}`,
      "",
      "## Post data (JSON):",
      JSON.stringify(postsForAnalysis, null, 2),
    ].join("\n");

    const claudeResponse = await callClaude({
      tier: "execution",
      systemPrompt: SOCIAL_ANALYSIS_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 4096,
      temperature: 0.3,
    });

    let analysis: Record<string, unknown>;
    try {
      analysis = parseClaudeJson(claudeResponse.text);
    } catch {
      analysis = { rawText: claudeResponse.text };
    }

    // -----------------------------------------------------------------------
    // Step 5: Store analysis in sig_social_analyses
    // -----------------------------------------------------------------------

    const { data: analysisRecord, error: analysisError } = await supabase
      .from("sig_social_analyses")
      .insert({
        org_id: DEFAULT_ORG_ID,
        scrape_id: scrapeId,
        platform,
        username,
        analysis,
        tokens_in: claudeResponse.usage.inputTokens,
        tokens_out: claudeResponse.usage.outputTokens,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (analysisError) {
      console.error("Failed to store analysis:", analysisError.message);
      // Non-fatal: still return analysis to caller
    }

    // -----------------------------------------------------------------------
    // Step 6: Push notification — analysis complete
    // -----------------------------------------------------------------------
    await createNotification({
      title: "Social Analysis Complete",
      message: `Analysis of @${username} on ${platform} complete. ${normalisedPosts.length} posts analysed with engagement data and content recommendations.`,
      category: "social",
      priority: "medium",
      sourceModule: "social",
      sourceUrl: "/social",
      actions: [{ label: "View Analysis", url: "/social" }],
    });

    // -----------------------------------------------------------------------
    // Step 7: Return the analysis
    // -----------------------------------------------------------------------

    return NextResponse.json({
      data: {
        scrapeId,
        analysisId: (analysisRecord?.id as string) ?? null,
        platform,
        username,
        postsAnalysed: normalisedPosts.length,
        analysis,
        usage: {
          inputTokens: claudeResponse.usage.inputTokens,
          outputTokens: claudeResponse.usage.outputTokens,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/social/analyse error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
