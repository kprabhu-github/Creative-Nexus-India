// GET /api/searchlens/sentiment-history?limit=N
// Returns a chronological time-series (oldest -> newest) of recent ais_scans
// rows for the active org, with the fields needed by the Overview trend chart.
// Sibling to /api/searchlens/history (which is a single-scan view-model);
// kept separate so we don't bloat the history projection just to expose 10 rows.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

interface ScanTrendRow {
  share_of_voice: number | null;
  visibility_score: number | null;
  sentiment: { positive?: number; neutral?: number; negative?: number } | null;
  scanned_at: string | null;
  created_at: string | null;
}

export async function GET(request: Request) {
  try {
    const limitRaw = Number(
      new URL(request.url).searchParams.get("limit") ?? DEFAULT_LIMIT,
    );
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limitRaw)))
      : DEFAULT_LIMIT;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ais_scans")
      .select("share_of_voice, visibility_score, sentiment, scanned_at, created_at")
      .eq("org_id", ORG_ID)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("sentiment-history error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = ((data ?? []) as ScanTrendRow[]).slice().reverse();
    const points = rows.map((r) => ({
      scannedAt: r.scanned_at ?? r.created_at ?? "",
      shareOfVoice: r.share_of_voice ?? 0,
      visibilityScore: r.visibility_score ?? 0,
      sentiment: {
        positive: r.sentiment?.positive ?? 0,
        neutral: r.sentiment?.neutral ?? 0,
        negative: r.sentiment?.negative ?? 0,
      },
    }));

    return NextResponse.json({ data: { points } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/searchlens/sentiment-history error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
