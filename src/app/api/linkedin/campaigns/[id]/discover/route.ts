// POST /api/linkedin/campaigns/[id]/discover
// Runs Apify actor for the campaign's source, inserts prospects.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverProspects, mapProspectToRow, ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json().catch(() => ({}))) as {
    max_results?: number;
    source_override?: string;
    url_override?: string;
  };

  const supabase = createAdminClient();

  const { data: campaign, error } = await supabase
    .from("linkedin_campaigns")
    .select("id, name, source, source_url, account_id")
    .eq("id", params.id)
    .single();

  if (error || !campaign) {
    return NextResponse.json(
      { error: `Campaign not found: ${error?.message ?? "no record"}` },
      { status: 404 },
    );
  }

  const source = body.source_override ?? campaign.source;
  const sourceUrl = body.url_override ?? campaign.source_url;

  if (!sourceUrl) {
    return NextResponse.json(
      { error: "Campaign has no source URL — set one on the campaign first." },
      { status: 400 },
    );
  }

  let raws;
  try {
    raws = await discoverProspects({
      source,
      sourceUrl,
      campaignId: campaign.id,
      maxResults: body.max_results ?? 30,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    await supabase.from("linkedin_activity_log").insert({
      account_id: campaign.account_id,
      message: `Discover failed for "${campaign.name}": ${message}`,
      type: "error",
      org_id: ORG_ID,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const rows = raws.map((r) => ({
    ...mapProspectToRow(campaign.id, r),
    org_id: ORG_ID,
  }));

  if (rows.length === 0) {
    return NextResponse.json({
      data: { inserted: 0, skipped: 0, prospects: [] },
    });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("linkedin_prospects")
    .upsert(rows, { onConflict: "campaign_id,profile_url", ignoreDuplicates: true })
    .select("*");

  if (insertErr) {
    return NextResponse.json(
      { error: `Insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  const insertedCount = inserted?.length ?? 0;
  await supabase.from("linkedin_activity_log").insert({
    account_id: campaign.account_id,
    message: `Discovered ${insertedCount} prospects for "${campaign.name}"`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({
    data: {
      inserted: insertedCount,
      skipped: rows.length - insertedCount,
      prospects: inserted ?? [],
    },
  });
}
