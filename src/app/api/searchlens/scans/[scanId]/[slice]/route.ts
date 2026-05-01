// GET /api/searchlens/scans/[scanId]/[slice]
// Lazy per-tab fetch for /searchlens. Page hydrates Overview eagerly
// (from /history or scan-pro) and lazy-loads Citations / Insights /
// Prompts / Competitors only when the user activates that tab.
//
// Slices:
//   citations   → { data: { citations: CitationProjection[] } }
//   insights    → { data: { insights: InsightProjection[] } }
//   prompts     → { data: { prompts: PromptProjection[] } }
//   competitors → { data: { competitors: CompetitorProjection[] } }
//
// 404 if scan not found. 400 on validation errors. 500 on supabase errors.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPlatformMap,
  buildTrendBuckets,
  fetchCitationRows,
  projectCitation,
  projectCompetitor,
  projectInsight,
  projectPrompts,
  type PromptScoreRow,
  type RawCompetitor,
  type RawInsight,
  type ScanRow,
} from "@/lib/searchlens/projections";

export const dynamic = "force-dynamic";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

const SliceSchema = z.enum(["citations", "insights", "prompts", "competitors"]);
const ScanIdSchema = z.string().uuid();

type Slice = z.infer<typeof SliceSchema>;

interface RouteContext {
  params: Promise<{ scanId: string; slice: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  try {
    const { scanId: scanIdRaw, slice: sliceRaw } = await ctx.params;

    const scanIdParsed = ScanIdSchema.safeParse(scanIdRaw);
    if (!scanIdParsed.success) {
      return NextResponse.json({ error: "Invalid scanId" }, { status: 400 });
    }
    const sliceParsed = SliceSchema.safeParse(sliceRaw);
    if (!sliceParsed.success) {
      return NextResponse.json({ error: "Invalid slice" }, { status: 400 });
    }

    const scanId = scanIdParsed.data;
    const slice: Slice = sliceParsed.data;
    const supabase = createAdminClient();

    // Verify scan exists + belongs to org. Also pull the columns we need
    // for jsonb-backed slices (insights, competitor_comparison) and
    // brand_name for prompt trend lookup.
    const { data: scanData, error: scanError } = await supabase
      .from("ais_scans")
      .select(
        "id, brand_name, visibility_score, citation_count, share_of_voice, recommendation_rate, citation_authority, sentiment, platform_breakdown, prompt_gaps, competitor_comparison, insights, scanned_at, created_at",
      )
      .eq("org_id", ORG_ID)
      .eq("id", scanId)
      .maybeSingle();

    if (scanError) {
      console.error("slice scan fetch error:", scanError.message);
      return NextResponse.json({ error: scanError.message }, { status: 500 });
    }
    if (!scanData) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }
    const scan = scanData as ScanRow;
    const fallbackDate = scan.scanned_at ?? scan.created_at ?? "";

    if (slice === "citations") {
      const { rows, error } = await fetchCitationRows(supabase, scanId);
      if (error) {
        return NextResponse.json({ error }, { status: 500 });
      }
      const citations = rows.map((c) => projectCitation(c, fallbackDate));
      return NextResponse.json({ data: { citations } });
    }

    if (slice === "insights") {
      const insights = (scan.insights ?? []).map((ins: RawInsight, i: number) =>
        projectInsight(ins, i),
      );
      return NextResponse.json({ data: { insights } });
    }

    if (slice === "competitors") {
      const competitors = (scan.competitor_comparison ?? []).map(
        (c: RawCompetitor) => projectCompetitor(c),
      );
      return NextResponse.json({ data: { competitors } });
    }

    // slice === "prompts"
    // Read citations for this scan to derive per-prompt platform coverage,
    // then read the last 500 ais_prompt_scores rows for the same brand to
    // build per-prompt trend buckets (last 7 chronological scores).
    const { rows: cRows, error: citationsError } = await fetchCitationRows(
      supabase,
      scanId,
    );
    if (citationsError) {
      return NextResponse.json({ error: citationsError }, { status: 500 });
    }

    const brandName = scan.brand_name ?? "";
    const { data: settingsData } = await supabase
      .from("core_agency_config")
      .select("searchlens_prompts")
      .eq("org_id", ORG_ID)
      .maybeSingle();
    const settingsPrompts =
      ((settingsData ?? {}) as { searchlens_prompts?: string[] | null })
        .searchlens_prompts ?? [];

    const { data: promptScoreData, error: promptScoreError } = await supabase
      .from("ais_prompt_scores")
      .select("prompt, score, scanned_at")
      .eq("org_id", ORG_ID)
      .eq("brand_name", brandName)
      .order("scanned_at", { ascending: false })
      .limit(500);
    if (promptScoreError) {
      return NextResponse.json(
        { error: promptScoreError.message },
        { status: 500 },
      );
    }

    const platformMap = buildPlatformMap(cRows);
    const trendData = buildTrendBuckets(
      (promptScoreData ?? []) as PromptScoreRow[],
    );

    const promptList =
      settingsPrompts.length > 0
        ? settingsPrompts
        : Array.from(platformMap.keys());
    const prompts = projectPrompts(
      promptList,
      platformMap,
      trendData,
      fallbackDate,
    );

    return NextResponse.json({ data: { prompts } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/searchlens/scans/[id]/[slice] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
