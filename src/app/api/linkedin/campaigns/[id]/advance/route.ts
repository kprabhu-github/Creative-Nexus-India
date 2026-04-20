// POST /api/linkedin/campaigns/[id]/advance
// Batch-advances prospects through the funnel — moves all "pending" and
// "in_sequence" prospects forward one step, caps at funnel_steps.length.
// Simulates sending — does NOT actually post to LinkedIn (that requires a
// browser automation layer beyond Apify).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: campaign, error } = await supabase
    .from("linkedin_campaigns")
    .select("id, name, funnel_steps, account_id")
    .eq("id", params.id)
    .single();

  if (error || !campaign) {
    return NextResponse.json(
      { error: `Campaign not found: ${error?.message ?? "no record"}` },
      { status: 404 },
    );
  }

  const steps = Array.isArray(campaign.funnel_steps) ? campaign.funnel_steps : [];
  const totalSteps = steps.length;

  if (totalSteps === 0) {
    return NextResponse.json(
      { error: "Campaign has no funnel steps — build a sequence first." },
      { status: 400 },
    );
  }

  const { data: pending } = await supabase
    .from("linkedin_prospects")
    .select("id, step, status")
    .eq("campaign_id", params.id)
    .in("status", ["pending", "in_sequence"]);

  if (!pending || pending.length === 0) {
    return NextResponse.json({
      data: { advanced: 0, message: "No prospects to advance." },
    });
  }

  const now = new Date().toISOString();
  let advancedCount = 0;

  for (const p of pending) {
    const next = p.step + 1;
    if (next > totalSteps) continue;

    const { error: updErr } = await supabase
      .from("linkedin_prospects")
      .update({
        step: next,
        status: "in_sequence",
        last_action: now,
      })
      .eq("id", p.id);

    if (!updErr) advancedCount++;
  }

  await supabase.from("linkedin_activity_log").insert({
    account_id: campaign.account_id,
    message: `Auto-run: advanced ${advancedCount} prospects in "${campaign.name}"`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({
    data: { advanced: advancedCount, total_steps: totalSteps },
  });
}
