// GET /api/searchlens/history — hydrate /searchlens from latest scan.
// Returns { data } shaped for the page view-model, or { data: null }
// when no scan has been run. Reads ais_scans (latest), ais_citations
// (for that scan), ais_prompt_scores (last 7 per prompt across history).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

type PlatformKey =
  | "chatgpt" | "gemini" | "perplexity" | "ai-overviews" | "copilot" | "claude";
type Position = "prominent" | "passing" | "absent";
type Sentiment = "positive" | "neutral" | "negative";
type InsightCategory = "Content" | "Technical" | "Authority" | "Competitive";

interface CitationRow {
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
interface PromptScoreRow {
  prompt: string | null;
  score: number | null;
  scanned_at: string | null;
}
interface InsightShape {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  actionItem?: string;
}
interface ScanRow {
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
  competitor_comparison: Array<{ name: string; mentions?: number; score?: number }> | null;
  insights: InsightShape[] | null;
  scanned_at: string | null;
  created_at: string | null;
}

const VALID_PLATFORM_KEYS: PlatformKey[] = [
  "chatgpt", "gemini", "perplexity", "ai-overviews", "copilot", "claude",
];

const normPlatform = (raw: string | null | undefined): PlatformKey => {
  const lower = (raw ?? "").toLowerCase().replace(/_/g, "-");
  return (VALID_PLATFORM_KEYS as string[]).includes(lower)
    ? (lower as PlatformKey)
    : "chatgpt";
};

const normPosition = (raw: string | null | undefined): Position =>
  raw === "prominent" || raw === "passing" || raw === "absent" ? raw : "absent";

const normSentiment = (raw: string | null | undefined): Sentiment =>
  raw === "positive" || raw === "negative" ? raw : "neutral";

const normPriority = (raw: string | undefined): "critical" | "high" | "medium" | "low" =>
  raw === "critical" || raw === "high" || raw === "low" ? raw : "medium";

const normCategory = (raw: string | undefined): InsightCategory => {
  const lower = (raw ?? "").toLowerCase();
  if (lower === "technical") return "Technical";
  if (lower === "authority") return "Authority";
  if (lower === "competitive") return "Competitive";
  return "Content";
};

const targetModule = (c: InsightCategory): string =>
  c === "Technical" ? "site-audit"
    : c === "Authority" ? "nexus-flow"
      : c === "Competitive" ? "signal" : "gtm";

const safeHostname = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
};

export async function GET(request: Request) {
  try {
    // limit param is validated but reserved — we always return the latest scan.
    const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "1");
    void (Number.isFinite(limitRaw) ? Math.max(1, Math.min(10, Math.trunc(limitRaw))) : 1);

    const supabase = createAdminClient();

    const { data: scanData, error: scanError } = await supabase
      .from("ais_scans")
      .select(
        "id, brand_name, visibility_score, citation_count, share_of_voice, recommendation_rate, citation_authority, sentiment, platform_breakdown, prompt_gaps, competitor_comparison, insights, scanned_at, created_at",
      )
      .eq("org_id", ORG_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scanError) {
      console.error("history scan error:", scanError.message);
      return NextResponse.json({ error: scanError.message }, { status: 500 });
    }
    if (!scanData) return NextResponse.json({ data: null });
    const scan = scanData as ScanRow;

    const { data: citationData, error: citationError } = await supabase
      .from("ais_citations")
      .select(
        "id, platform, prompt, position, context, sentiment, authority_score, citation_url, scanned_at",
      )
      .eq("scan_id", scan.id);

    if (citationError) {
      console.error("history citations error:", citationError.message);
      return NextResponse.json({ error: citationError.message }, { status: 500 });
    }
    const cRows = (citationData ?? []) as CitationRow[];
    const citations = cRows.map((c) => {
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
        date: c.scanned_at ?? scan.scanned_at ?? scan.created_at ?? "",
      };
    });

    const domainMap = new Map<string, { mentionCount: number; sum: number; count: number }>();
    for (const c of cRows) {
      const host = safeHostname(c.citation_url);
      if (!host) continue;
      const e = domainMap.get(host) ?? { mentionCount: 0, sum: 0, count: 0 };
      e.mentionCount += 1;
      const a = c.authority_score ?? 0;
      if (a > 0) {
        e.sum += a;
        e.count += 1;
      }
      domainMap.set(host, e);
    }
    const citedDomains = Array.from(domainMap.entries())
      .map(([domain, v]) => {
        const avgAuthority = v.count > 0 ? Math.round(v.sum / v.count) : 0;
        return {
          domain,
          mentionCount: v.mentionCount,
          avgAuthority,
          score: Math.round(v.mentionCount * (avgAuthority / 100)),
        };
      })
      .sort((a, b) => b.mentionCount - a.mentionCount);

    const { data: settingsData } = await supabase
      .from("core_agency_config")
      .select("domain, searchlens_brand_name, searchlens_prompts")
      .eq("org_id", ORG_ID)
      .maybeSingle();
    const s = (settingsData ?? {}) as { domain?: string | null; searchlens_brand_name?: string | null; searchlens_prompts?: string[] | null };
    const brandName = scan.brand_name ?? s.searchlens_brand_name ?? "";
    const domain = s.domain ?? null;
    const settingsPrompts = s.searchlens_prompts ?? [];

    const { data: promptScoreData } = await supabase
      .from("ais_prompt_scores")
      .select("prompt, score, scanned_at")
      .eq("org_id", ORG_ID)
      .eq("brand_name", brandName)
      .order("scanned_at", { ascending: false })
      .limit(500);

    const trendBuckets = new Map<string, PromptScoreRow[]>();
    for (const row of (promptScoreData ?? []) as PromptScoreRow[]) {
      if (!row.prompt) continue;
      const arr = trendBuckets.get(row.prompt) ?? [];
      arr.push(row);
      trendBuckets.set(row.prompt, arr);
    }

    const platformMap = new Map<string, Record<string, boolean>>();
    for (const c of cRows) {
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

    const promptList =
      settingsPrompts.length > 0
        ? settingsPrompts
        : Array.from(platformMap.keys());

    const prompts = promptList.map((p, idx) => {
      const trendData = (trendBuckets.get(p) ?? [])
        .slice(0, 7)
        .reverse()
        .map((r) => r.score ?? 0);
      const score = trendData.length > 0 ? trendData[trendData.length - 1] : 0;
      const platforms =
        platformMap.get(p) ??
        Object.fromEntries(VALID_PLATFORM_KEYS.map((k) => [k, false]));
      return {
        id: `p-${idx}`,
        prompt: p,
        score,
        platforms,
        competitorCount: 0, // not tracked per-prompt in current schema
        lastChecked: scan.scanned_at ?? scan.created_at ?? "",
        trendData,
      };
    });

    const platformBreakdown = VALID_PLATFORM_KEYS.map((key) => {
      const dbKey = key === "ai-overviews" ? "ai_overviews" : key;
      const e = scan.platform_breakdown?.[dbKey] ?? scan.platform_breakdown?.[key];
      return {
        key,
        mentions: e?.mentions ?? 0,
        score: e?.score ?? 0,
        trend: "0%",
        trendUp: null as boolean | null,
      };
    });

    const competitorComparison = (scan.competitor_comparison ?? []).map((c) => ({
      name: c.name,
      mentionCount: c.mentions ?? 0,
      promptsAppearedIn: [] as string[],
    }));

    const insights = (scan.insights ?? []).map((ins, idx) => {
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
    });

    return NextResponse.json({
      data: {
        brandName,
        domain,
        visibilityScore: scan.visibility_score ?? 0,
        citationCount: scan.citation_count ?? 0,
        shareOfVoice: scan.share_of_voice ?? 0,
        recommendationRate: scan.recommendation_rate ?? 0,
        citationAuthority: scan.citation_authority ?? 0,
        sentiment: {
          positive: scan.sentiment?.positive ?? 0,
          neutral: scan.sentiment?.neutral ?? 0,
          negative: scan.sentiment?.negative ?? 0,
        },
        platformBreakdown,
        promptGaps: scan.prompt_gaps ?? [],
        competitorComparison,
        citations,
        insights,
        prompts,
        citedDomains,
        scannedAt: scan.scanned_at ?? scan.created_at ?? "",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/searchlens/history error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
