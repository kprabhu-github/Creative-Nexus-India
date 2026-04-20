// GET  /api/linkedin/campaigns — list campaigns with stats
// POST /api/linkedin/campaigns — create new campaign with funnel steps

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

interface FunnelStepInput {
  id?: string;
  actionId: string;
  delay: number;
  dailyLimit: number;
  template: string;
  replyDetect?: boolean;
  aiPersonalise?: boolean;
  spintax?: boolean;
  attachImage?: boolean;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("linkedin_campaigns_with_stats")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load campaigns: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name: string;
    account_id?: string | null;
    source?: string;
    source_url?: string;
    description?: string;
    funnel_steps?: FunnelStepInput[];
    status?: "draft" | "active" | "paused" | "complete";
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("linkedin_campaigns")
    .insert({
      name: body.name.trim(),
      account_id: body.account_id || null,
      source: body.source ?? "company_employees",
      source_url: body.source_url ?? "",
      description: body.description ?? "",
      funnel_steps: body.funnel_steps ?? [],
      status: body.status ?? "draft",
      org_id: ORG_ID,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create campaign: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    account_id: body.account_id || null,
    message: `Campaign launched: "${data.name}"`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({ data });
}
