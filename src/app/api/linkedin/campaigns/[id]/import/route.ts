// POST /api/linkedin/campaigns/[id]/import
// Bulk-insert prospects from CSV text or a LinkedIn URL list.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

// ─── Simple CSV parser (handles quoted fields with embedded commas) ──────
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const stripped = text.replace(/^\uFEFF/, ""); // BOM
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === "," && !inQuote) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

// Map common CSV header variants to our DB fields
const FIELD_ALIASES: Record<string, string> = {
  name: "name",
  full_name: "name",
  fullname: "name",
  first_name: "first_name",
  firstname: "first_name",
  headline: "headline",
  title: "headline",
  job_title: "headline",
  jobtitle: "headline",
  company: "company",
  company_name: "company",
  companyname: "company",
  organization: "company",
  industry: "industry",
  sector: "industry",
  location: "location",
  city: "location",
  email: "email",
  work_email: "email",
  email_address: "email",
  linkedin: "profile_url",
  linkedin_url: "profile_url",
  linkedinurl: "profile_url",
  profile_url: "profile_url",
  profileurl: "profile_url",
  url: "profile_url",
};

function normaliseRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const canonical = FIELD_ALIASES[k];
    if (canonical && v.trim().length > 0) {
      out[canonical] = v.trim();
    }
  }
  return out;
}

function firstNameFrom(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function isValidLinkedInUrl(url: string): boolean {
  return /linkedin\.com\/(in|company)\/[^\/\s?]+/i.test(url);
}

function buildProspectRowFromCsv(
  campaignId: string,
  raw: Record<string, string>,
): Record<string, unknown> | null {
  const name = raw.name?.trim() || "";
  const profileUrl = raw.profile_url?.trim() || null;

  if (!name && !profileUrl) return null; // need at least one identifier

  const email = raw.email?.trim() || null;

  let score = 60;
  if (email) score += 20;
  if (raw.headline?.trim()) score += 10;
  score = Math.min(Math.max(score, 0), 100);

  return {
    campaign_id: campaignId,
    name: name || profileUrl || "Unknown",
    first_name: raw.first_name?.trim() || firstNameFrom(name),
    headline: raw.headline?.trim() ?? "",
    company: raw.company?.trim() ?? "",
    industry: raw.industry?.trim() ?? "",
    location: raw.location?.trim() ?? "",
    profile_url: profileUrl && isValidLinkedInUrl(profileUrl) ? profileUrl : null,
    email,
    score,
    step: 0,
    status: "pending",
    reply_received: false,
    raw_apify: raw as unknown as Record<string, unknown>,
    org_id: ORG_ID,
  };
}

function buildProspectRowFromUrl(campaignId: string, url: string): Record<string, unknown> | null {
  const cleanUrl = url.trim();
  if (!isValidLinkedInUrl(cleanUrl)) return null;

  // Extract slug as a placeholder name until user runs enrichment
  const match = cleanUrl.match(/linkedin\.com\/(?:in|company)\/([^\/?#]+)/i);
  const slug = match?.[1] ?? "linkedin-profile";
  const placeholder = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    campaign_id: campaignId,
    name: placeholder,
    first_name: firstNameFrom(placeholder),
    headline: "",
    company: "",
    industry: "",
    location: "",
    profile_url: cleanUrl,
    email: null,
    score: 50,
    step: 0,
    status: "pending",
    reply_received: false,
    raw_apify: { source: "url_import" },
    org_id: ORG_ID,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    type: "csv" | "urls";
    data: string;
  };

  if (!body.type || !body.data) {
    return NextResponse.json(
      { error: "Missing type or data in request body" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: campaign, error: campErr } = await supabase
    .from("linkedin_campaigns")
    .select("id, name, account_id")
    .eq("id", params.id)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json(
      { error: `Campaign not found: ${campErr?.message ?? "no record"}` },
      { status: 404 },
    );
  }

  const rows: Record<string, unknown>[] = [];
  let invalidCount = 0;

  if (body.type === "csv") {
    const { rows: parsed } = parseCsv(body.data);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "CSV appears empty or unreadable" },
        { status: 400 },
      );
    }
    for (const raw of parsed) {
      const norm = normaliseRow(raw);
      const prospect = buildProspectRowFromCsv(campaign.id, norm);
      if (prospect) rows.push(prospect);
      else invalidCount++;
    }
  } else if (body.type === "urls") {
    const urls = body.data
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    for (const url of urls) {
      const prospect = buildProspectRowFromUrl(campaign.id, url);
      if (prospect) rows.push(prospect);
      else invalidCount++;
    }
  } else {
    return NextResponse.json(
      { error: `Unknown import type: ${body.type}` },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: `No valid prospects found. ${invalidCount} row(s) skipped.` },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("linkedin_prospects")
    .upsert(rows, {
      onConflict: "campaign_id,profile_url",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertErr) {
    return NextResponse.json(
      { error: `Insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  const insertedCount = inserted?.length ?? 0;
  const duplicatesSkipped = rows.length - insertedCount;

  await supabase.from("linkedin_activity_log").insert({
    account_id: campaign.account_id,
    message: `Imported ${insertedCount} prospects (${body.type.toUpperCase()}) for "${campaign.name}" — ${duplicatesSkipped} duplicates, ${invalidCount} invalid`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({
    data: {
      inserted: insertedCount,
      duplicates: duplicatesSkipped,
      invalid: invalidCount,
      total_parsed: rows.length + invalidCount,
    },
  });
}
