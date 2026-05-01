// GET /api/searchlens/history — hydrate /searchlens from latest scan.
// Returns { data } shaped for the page view-model (Overview slice +
// citations/insights/prompts/competitors for legacy/back-compat),
// or { data: null } when no scan has been run.
//
// Note: as of the lazy-tab refactor the page only consumes the Overview
// fields from this response on mount. Tab data is lazy-loaded via
// /api/searchlens/scans/[scanId]/[slice]. We still return the full
// payload here so a hard refresh can render any tab if the user
// navigates directly via URL.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPlatformMap,
  buildTrendBuckets,
  fetchCitationRows,
  projectCitation,
  projectCompetitor,
  projectInsight,
  projectPrompts,
  safeHostname,
  VALID_PLATFORM_KEYS,
  type PromptScoreRow,
  type ScanRow,
} from "@/lib/searchlens/projections";

export const dynamic = "force-dynamic";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

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
    const fallbackDate = scan.scanned_at ?? scan.created_at ?? "";

    const { rows: cRows, error: citationError } = await fetchCitationRows(
      supabase,
      scan.id,
    );
    if (citationError) {
      console.error("history citations error:", citationError);
      return NextResponse.json({ error: citationError }, { status: 500 });
    }
    const citations = cRows.map((c) => projectCitation(c, fallbackDate));

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
    const s = (settingsData ?? {}) as {
      domain?: string | null;
      searchlens_brand_name?: string | null;
      searchlens_prompts?: string[] | null;
    };
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

    const platformMap = buildPlatformMap(cRows);
    const trendData = buildTrendBuckets(
      (promptScoreData ?? []) as PromptScoreRow[],
    );

    const promptList =
      settingsPrompts.length > 0 ? settingsPrompts : Array.from(platformMap.keys());
    const prompts = projectPrompts(promptList, platformMap, trendData, fallbackDate);

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

    const competitorComparison = (scan.competitor_comparison ?? []).map((c) =>
      projectCompetitor(c),
    );

    const insights = (scan.insights ?? []).map((ins, idx) =>
      projectInsight(ins, idx),
    );

    return NextResponse.json({
      data: {
        scanId: scan.id,
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
        scannedAt: fallbackDate,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/searchlens/history error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
