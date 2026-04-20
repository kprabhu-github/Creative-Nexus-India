// ---------------------------------------------------------------------------
// POST /api/linkedin/accounts/[id]/rescrape — refresh account data via Apify
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeLinkedInUrl, ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("linkedin_accounts")
    .select("id,url,name")
    .eq("id", params.id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: `Account not found: ${fetchErr?.message ?? "no row"}` },
      { status: 404 },
    );
  }

  let row: Awaited<ReturnType<typeof scrapeLinkedInUrl>>;
  try {
    row = await scrapeLinkedInUrl(existing.url, existing.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    await supabase.from("linkedin_activity_log").insert({
      account_id: params.id,
      message: `Rescrape failed for ${existing.name}: ${message}`,
      type: "error",
      org_id: ORG_ID,
    });
    return NextResponse.json(
      { error: `Apify scrape failed: ${message}` },
      { status: 502 },
    );
  }

  // Don't overwrite limits / working_hours / status on rescrape.
  const { slug: _slug, type: _type, url: _url, ...rescrapeFields } = row;
  void _slug;
  void _type;
  void _url;
  const updates: Record<string, unknown> = { ...rescrapeFields };
  delete updates.daily_limits;
  delete updates.working_hours;
  delete updates.allowed_actions;
  delete updates.status;
  delete updates.role;

  const { data: updated, error: updateErr } = await supabase
    .from("linkedin_accounts")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: `Update failed: ${updateErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    account_id: params.id,
    message: `Re-scraped ${updated.name} — ${updated.followers ?? 0} followers, ${updated.connections ?? "—"} connections`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({ data: updated });
}
