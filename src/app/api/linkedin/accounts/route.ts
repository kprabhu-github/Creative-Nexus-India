// ---------------------------------------------------------------------------
// GET  /api/linkedin/accounts  — list all accounts + today's usage
// POST /api/linkedin/accounts  — add new account (scrapes via Apify)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  scrapeLinkedInUrl,
  typeFromUrl,
  slugFromUrl,
  DEFAULT_PERSONAL_ACTIONS,
  DEFAULT_COMPANY_ACTIONS,
  DEFAULT_PERSONAL_LIMITS,
  DEFAULT_COMPANY_LIMITS,
  DEFAULT_WORKING_HOURS,
  ORG_ID,
} from "@/lib/linkedin";

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

  const isCompany = typeFromUrl(url) === "company";
  let row: Awaited<ReturnType<typeof scrapeLinkedInUrl>>;
  let scrapeWarning: string | null = null;

  try {
    row = await scrapeLinkedInUrl(url, body.name);
  } catch (err) {
    // Fallback: build a minimal stub row so the user can keep working.
    // They can click Re-scrape later once their Apify actor is configured.
    const message = err instanceof Error ? err.message : "Scrape failed";
    scrapeWarning = message;
    await supabase.from("linkedin_activity_log").insert({
      message: `Apify scrape failed for ${url} — added as stub. (${message.slice(0, 200)})`,
      type: "warn",
      org_id: ORG_ID,
    });

    const slug = slugFromUrl(url);
    const placeholderName =
      body.name?.trim() ||
      slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    if (isCompany) {
      row = {
        slug,
        type: "company" as const,
        url,
        name: placeholderName,
        headline: "",
        subline: "",
        location: "",
        connections: null,
        followers: 0,
        employee_count: null,
        founded: null,
        company_size: null,
        pic: null,
        specialties: [],
        allowed_actions: DEFAULT_COMPANY_ACTIONS,
        daily_limits: DEFAULT_COMPANY_LIMITS,
        working_hours: DEFAULT_WORKING_HOURS,
        status: "ready" as const,
        role: "Company page — grow followers, company awareness, post engagement, event invitations",
        scraped_at: new Date().toISOString(),
        raw_apify: null,
      };
    } else {
      row = {
        slug,
        type: "personal" as const,
        url,
        name: placeholderName,
        headline: "",
        subline: "",
        location: "",
        connections: null,
        followers: 0,
        recommendations: null,
        experience: null,
        pic: null,
        bg: null,
        verified: false,
        premium: false,
        skills: [],
        prev_companies: [],
        specialties: [],
        education: null,
        allowed_actions: DEFAULT_PERSONAL_ACTIONS,
        daily_limits: DEFAULT_PERSONAL_LIMITS,
        working_hours: DEFAULT_WORKING_HOURS,
        status: "ready" as const,
        role: "Personal outreach — connection requests, direct messages, endorsements, profile warm-up",
        scraped_at: new Date().toISOString(),
        raw_apify: null,
      };
    }
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
    message: scrapeWarning
      ? `Added ${isCompany ? "company page" : "profile"} as stub (scrape failed — click Re-scrape when ready): ${inserted.name}`
      : `Added ${isCompany ? "company page" : "profile"}: ${inserted.name}`,
    type: scrapeWarning ? "warn" : "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({
    data: inserted,
    warning: scrapeWarning
      ? `Saved as stub — Apify scrape failed: ${scrapeWarning}. Set APIFY_LINKEDIN_PROFILE_ACTOR / APIFY_LINKEDIN_COMPANY_ACTOR env vars on Hostinger with actors you've subscribed to on Apify.`
      : null,
  });
}
