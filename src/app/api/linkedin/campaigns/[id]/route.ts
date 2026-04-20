// GET    /api/linkedin/campaigns/[id] — campaign + prospects
// PATCH  /api/linkedin/campaigns/[id] — update fields
// DELETE /api/linkedin/campaigns/[id] — remove campaign (cascades prospects)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const [{ data: campaign, error: campErr }, { data: prospects }] = await Promise.all([
    supabase.from("linkedin_campaigns_with_stats").select("*").eq("id", params.id).single(),
    supabase
      .from("linkedin_prospects")
      .select("*")
      .eq("campaign_id", params.id)
      .order("score", { ascending: false }),
  ]);

  if (campErr || !campaign) {
    return NextResponse.json(
      { error: `Campaign not found: ${campErr?.message ?? "no record"}` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: { campaign, prospects: prospects ?? [] },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    name?: string;
    account_id?: string | null;
    source?: string;
    source_url?: string;
    description?: string;
    funnel_steps?: unknown[];
    status?: "draft" | "active" | "paused" | "complete";
  };

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.account_id !== undefined) updates.account_id = body.account_id;
  if (body.source !== undefined) updates.source = body.source;
  if (body.source_url !== undefined) updates.source_url = body.source_url;
  if (body.description !== undefined) updates.description = body.description;
  if (body.funnel_steps !== undefined) updates.funnel_steps = body.funnel_steps;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("linkedin_campaigns")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Update failed: ${error?.message ?? "not found"}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: camp } = await supabase
    .from("linkedin_campaigns")
    .select("name")
    .eq("id", params.id)
    .maybeSingle();

  const { error } = await supabase
    .from("linkedin_campaigns")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error.message}` },
      { status: 500 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    message: `Campaign removed: "${camp?.name ?? params.id}"`,
    type: "warn",
    org_id: ORG_ID,
  });

  return NextResponse.json({ data: { deleted: true } });
}
