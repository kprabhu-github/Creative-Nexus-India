// ---------------------------------------------------------------------------
// GET /api/linkedin/prospects
// Prospect Inbox list endpoint. Human-in-the-loop CRM — no automation.
// Supports filters: campaign, status, min/max score, industry, search, sort.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_SORT = new Set([
  "score",
  "last_action",
  "created_at",
  "name",
  "step",
  "completed_at",
]);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const campaignId = sp.get("campaign_id") || null;
  const status = sp.get("status") || null; // "pending" | "in_sequence" | "replied" | "meeting" | "opted_out"
  const minScore = sp.get("min_score");
  const maxScore = sp.get("max_score");
  const industry = sp.get("industry") || null;
  const search = sp.get("q") || null;
  const sortParam = sp.get("sort") || "score";
  const sort = ALLOWED_SORT.has(sortParam) ? sortParam : "score";
  const dir = sp.get("dir") === "asc" ? { ascending: true } : { ascending: false };
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 500);

  const supabase = createAdminClient();

  let query = supabase
    .from("linkedin_prospects")
    .select(
      `
        id, name, first_name, headline, company, industry, location, email,
        profile_url, score, step, status, reply_received, last_action, last_message,
        suggested_action, suggested_message, operator_notes, opened_at, completed_at,
        created_at, updated_at, campaign_id,
        linkedin_campaigns:campaign_id ( id, name, status, account_id )
      `,
    )
    .order(sort, { ...dir, nullsFirst: false })
    .limit(limit);

  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (status) query = query.eq("status", status);
  if (minScore !== null && !Number.isNaN(Number(minScore))) {
    query = query.gte("score", Number(minScore));
  }
  if (maxScore !== null && !Number.isNaN(Number(maxScore))) {
    query = query.lte("score", Number(maxScore));
  }
  if (industry) query = query.ilike("industry", `%${industry}%`);
  if (search) {
    // Search name, headline, company, email
    query = query.or(
      `name.ilike.%${search}%,headline.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `Failed to load prospects: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
