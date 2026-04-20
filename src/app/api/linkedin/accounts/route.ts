// ---------------------------------------------------------------------------
// GET  /api/linkedin/accounts  — list all accounts + today's usage
// POST /api/linkedin/accounts  — add new account (scrapes via Apify)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeLinkedInUrl, typeFromUrl, ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = createAdminClient();

  const { data: accounts, error: accErr } = await supabase
    .from("linkedin_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (accErr) {
    return NextResponse.json(
      { error: `Failed to load accounts: ${accErr.message}` },
      { status: 500 },
    );
  }

  const today = istToday();
  const { data: usage } = await supabase
    .from("linkedin_usage")
    .select("account_id,action_key,count")
    .eq("date", today);

  const usageMap: Record<string, Record<string, number>> = {};
  (usage ?? []).forEach((u) => {
    usageMap[u.account_id] = usageMap[u.account_id] ?? {};
    usageMap[u.account_id][u.action_key] = u.count;
  });

  return NextResponse.json({
    data: { accounts: accounts ?? [], usage: usageMap, date: today },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { url: string; name?: string };

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const url = body.url.trim();
  if (!/linkedin\.com\/(in|company)\//i.test(url)) {
    return NextResponse.json(
      { error: "URL must be a linkedin.com/in/ or /company/ link" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Avoid duplicates
  const { data: existing } = await supabase
    .from("linkedin_accounts")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Account with this URL already exists" },
      { status: 409 },
    );
  }

  let row: Awaited<ReturnType<typeof scrapeLinkedInUrl>>;
  try {
    row = await scrapeLinkedInUrl(url, body.name);
  } catch (err) {
    // Log the failure but still create a minimal row so the user has something
    const message = err instanceof Error ? err.message : "Scrape failed";
    await supabase.from("linkedin_activity_log").insert({
      message: `Apify scrape failed for ${url}: ${message}`,
      type: "error",
      org_id: ORG_ID,
    });
    return NextResponse.json(
      {
        error: `Apify scrape failed: ${message}. Check APIFY_API_TOKEN and actor subscription.`,
      },
      { status: 502 },
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("linkedin_accounts")
    .insert({ ...row, org_id: ORG_ID })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: `Failed to save account: ${insertErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    account_id: inserted.id,
    message: `Added ${typeFromUrl(url) === "company" ? "company page" : "profile"}: ${inserted.name}`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({ data: inserted });
}
