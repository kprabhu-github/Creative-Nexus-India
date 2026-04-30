// ---------------------------------------------------------------------------
// POST /api/linkedin/prospects/import — compliant prospect ingestion.
//
// Accepts three input shapes:
//   1. { campaign_id, csv: "..." }       Paste CSV text (Sales Nav or generic)
//   2. { campaign_id, urls: [...] }      Paste LinkedIn URLs
//   3. { campaign_id, rows: [...] }      Pre-parsed rows (client-side)
//
// Every row's profile_url is validated against SAFE_PROFILE_URL_RE. Bad rows
// are returned in the response so the operator can see what was rejected.
// No scraping, no third-party calls.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSafeLinkedInUrl } from "@/lib/linkedin-compliance";

export const dynamic = "force-dynamic";

interface ImportRow {
  name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  company?: string;
  industry?: string;
  location?: string;
  profile_url?: string;
  email?: string;
}

// Very small CSV parser — handles quoted fields with commas and embedded quotes.
// We avoid pulling in a dep; the worst-case CSV from Sales Navigator is
// well-behaved.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

// Map a CSV object row (any of several formats) to our prospect shape.
function csvRowToProspect(row: Record<string, string>): ImportRow {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      if (row[k]) return row[k];
    }
    return "";
  };

  const first = pick("first_name", "firstname", "first name", "first");
  const last = pick("last_name", "lastname", "last name", "last");
  const fullName =
    pick("name", "full_name", "full name") || `${first} ${last}`.trim();

  return {
    name: fullName,
    first_name: first || fullName.split(" ")[0] || "",
    last_name: last,
    headline: pick("headline", "title", "job_title", "job title", "position"),
    company: pick("company", "company_name", "current_company", "organization"),
    industry: pick("industry", "sector"),
    location: pick("location", "city", "geographical_area"),
    profile_url: pick(
      "profile_url",
      "linkedin_url",
      "linkedin",
      "url",
      "profile",
      "li_profile_url",
      "sn_profile_url",
    ),
    email: pick("email", "email_address", "primary_email"),
  };
}

function score(row: ImportRow): number {
  let s = 60;
  if (row.email) s += 20;
  if (row.headline) s += 10;
  if (row.company) s += 5;
  return Math.min(100, Math.max(0, s));
}

function nameFromUrl(url: string): string {
  const m = url.match(/linkedin\.com\/in\/([A-Za-z0-9-_%.]+)/i);
  if (!m) return "Unknown";
  return m[1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    campaign_id?: string;
    csv?: string;
    urls?: string[];
    rows?: ImportRow[];
  };

  if (!body.campaign_id) {
    return NextResponse.json(
      { error: "campaign_id is required" },
      { status: 400 },
    );
  }

  // 1. Normalize input into ImportRow[]
  let candidates: ImportRow[] = [];

  if (body.csv && typeof body.csv === "string") {
    candidates = parseCsv(body.csv).map(csvRowToProspect);
  }

  if (Array.isArray(body.urls)) {
    const existing = new Set(candidates.map((c) => c.profile_url));
    for (const url of body.urls) {
      if (!url || existing.has(url)) continue;
      candidates.push({ name: nameFromUrl(url), profile_url: url });
    }
  }

  if (Array.isArray(body.rows)) {
    candidates = candidates.concat(body.rows);
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No rows to import. Provide csv, urls, or rows." },
      { status: 400 },
    );
  }

  // 2. Validate & split into inserts vs rejects
  const rejected: Array<{ row: ImportRow; reason: string }> = [];
  const validRows: Array<Record<string, unknown>> = [];
  const seenUrls = new Set<string>();

  for (const c of candidates) {
    if (!c.profile_url) {
      rejected.push({ row: c, reason: "Missing profile_url" });
      continue;
    }
    if (!isSafeLinkedInUrl(c.profile_url)) {
      rejected.push({
        row: c,
        reason: "Profile URL failed linkedin.com/{in,company} validation",
      });
      continue;
    }
    // Dedupe within this batch
    if (seenUrls.has(c.profile_url)) continue;
    seenUrls.add(c.profile_url);

    const fullName = c.name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || nameFromUrl(c.profile_url);

    validRows.push({
      campaign_id: body.campaign_id,
      name: fullName,
      first_name: c.first_name || fullName.split(" ")[0] || "",
      headline: c.headline ?? "",
      company: c.company ?? "",
      industry: c.industry ?? "",
      location: c.location ?? "",
      profile_url: c.profile_url,
      email: c.email || null,
      score: score(c),
      step: 0,
      status: "pending",
      reply_received: false,
    });
  }

  // 3. Insert with dedupe on (campaign_id, profile_url)
  const supabase = createAdminClient();
  let inserted = 0;
  let duplicates = 0;

  if (validRows.length > 0) {
    const { data, error } = await supabase
      .from("linkedin_prospects")
      .upsert(validRows, {
        onConflict: "campaign_id,profile_url",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      return NextResponse.json(
        { error: `Insert failed: ${error.message}`, rejected },
        { status: 500 },
      );
    }
    inserted = data?.length ?? 0;
    duplicates = validRows.length - inserted;
  }

  // 4. Log to activity feed
  await supabase.from("linkedin_activity_log").insert({
    message: `Imported ${inserted} prospects (${duplicates} duplicate, ${rejected.length} rejected)`,
    type: rejected.length > 0 ? "warn" : "success",
  });

  return NextResponse.json({
    ok: true,
    imported: inserted,
    duplicates,
    rejected,
    total_submitted: candidates.length,
  });
}
