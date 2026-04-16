// ---------------------------------------------------------------------------
// GET /api/leads/website — Fetch leads from creativenexus.in
// ---------------------------------------------------------------------------
// Aggregates leads from:
//   1. Gravity Forms (primary — v1 REST API with HMAC-SHA1 auth)
//   2. WordPress Comments (secondary — public REST API)
//
// Auth: Gravity Forms uses HMAC-SHA1 signature via query params.
//       WordPress comments are public (no auth needed).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadSource =
  | "gravity_form"
  | "comment";

type LeadStatus = "new" | "contacted" | "qualified" | "converted";

interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  value: number;
  status: LeadStatus;
  date: string;
  services: string[];
  meta: Record<string, unknown>;
}

interface SourceCounts {
  forms: number;
  comments: number;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  sources: SourceCounts;
  formBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Gravity Forms v1 API helper
// ---------------------------------------------------------------------------

const SITE_URL = (process.env.WOOCOMMERCE_URL || "https://creativenexus.in").replace(/\/+$/, "");

function gfSignedUrl(route: string, extraParams?: Record<string, string>): string | null {
  const publicKey = process.env.GRAVITY_FORMS_PUBLIC_KEY;
  const privateKey = process.env.GRAVITY_FORMS_PRIVATE_KEY;

  if (!publicKey || !privateKey) return null;

  const method = "GET";
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const stringToSign = `${publicKey}:${method}:${route}:${expires}`;
  const sig = crypto
    .createHmac("sha1", privateKey)
    .update(stringToSign)
    .digest("base64");

  const url = new URL(`${SITE_URL}/gravityformsapi/${route}`);
  url.searchParams.set("api_key", publicKey);
  url.searchParams.set("signature", sig);
  url.searchParams.set("expires", String(expires));
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function gfFetch<T>(route: string, extraParams?: Record<string, string>): Promise<{ data: T | null; error: string | null }> {
  const url = gfSignedUrl(route, extraParams);
  if (!url) {
    return { data: null, error: "Gravity Forms API keys not configured" };
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 0 },
    });

    if (res.status === 401 || res.status === 403) {
      return { data: null, error: `Gravity Forms auth failed (${res.status}). Check API keys in Forms > Settings > REST API.` };
    }

    if (res.status === 404) {
      return { data: null, error: null };
    }

    if (!res.ok) {
      return { data: null, error: `Gravity Forms returned ${res.status}` };
    }

    const json = await res.json();
    // v1 API wraps responses in { status, response }
    const response = json.response ?? json;
    return { data: response as T, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gravity Forms fetch failed";
    return { data: null, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Gravity Forms field extraction
// ---------------------------------------------------------------------------

// Forms on creativenexus.in use consistent field IDs:
//   1.3 = first name, 1.6 = last name
//   3   = email
//   4   = phone
//   5   = company
//   7.* = service checkboxes
//   8   = message
//   9   = website URL or category

interface GfEntry {
  id: string;
  form_id: string;
  date_created: string;
  source_url: string;
  [key: string]: unknown;
}

interface GfFormSummary {
  id: string;
  title: string;
  entries: string;
}

function extractName(entry: GfEntry): string {
  const first = String(entry["1.3"] || entry["1"] || "").trim();
  const last = String(entry["1.6"] || "").trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  // Fallback: scan for a name-like field
  return "";
}

function extractEmail(entry: GfEntry): string {
  // Field 3 is email in most forms
  const f3 = String(entry["3"] || "");
  if (f3.includes("@")) return f3;
  // Scan all fields for an email
  for (const [key, val] of Object.entries(entry)) {
    if (typeof val === "string" && val.includes("@") && val.includes(".") && !["id", "form_id", "source_url", "user_agent", "ip"].includes(key)) {
      return val;
    }
  }
  return "";
}

function extractPhone(entry: GfEntry): string {
  const f4 = String(entry["4"] || "");
  if (/\d{6,}/.test(f4.replace(/[\s\-+()]/g, ""))) return f4;
  const f3 = String(entry["3"] || "");
  if (!/[@.]/.test(f3) && /\d{6,}/.test(f3.replace(/[\s\-+()]/g, ""))) return f3;
  return "";
}

function extractCompany(entry: GfEntry): string {
  return String(entry["5"] || "").trim();
}

function extractMessage(entry: GfEntry): string {
  return String(entry["8"] || "").trim();
}

function extractServices(entry: GfEntry): string[] {
  const services: string[] = [];
  for (const [key, val] of Object.entries(entry)) {
    // Service checkboxes are 7.1, 7.11, 7.13, 7.21, etc.
    if (key.startsWith("7.") && typeof val === "string" && val.length > 0) {
      services.push(val);
    }
  }
  return services;
}

function isSpam(entry: GfEntry): boolean {
  const score = parseFloat(String(entry["gravityformsrecaptcha_score"] || "1"));
  if (score < 0.3) return true;
  // Check for garbled text in name
  const name = extractName(entry);
  if (name.length > 20 && !/\s/.test(name)) return true;
  return false;
}

// Forms that are internal / not lead-generating
const EXCLUDED_FORM_TITLES = ["job application"];

// ---------------------------------------------------------------------------
// Source: Gravity Forms
// ---------------------------------------------------------------------------

async function fetchGravityForms(): Promise<{
  leads: Lead[];
  formBreakdown: Record<string, number>;
  error: string | null;
}> {
  // Step 1: Get all forms
  const { data: formsData, error: formsError } = await gfFetch<Record<string, GfFormSummary>>("forms");

  if (formsError) return { leads: [], formBreakdown: {}, error: formsError };
  if (!formsData) return { leads: [], formBreakdown: {}, error: null };

  const forms = Object.values(formsData).filter(
    (f) => parseInt(f.entries) > 0 && !EXCLUDED_FORM_TITLES.includes(f.title.toLowerCase()),
  );

  // Step 2: Fetch entries from each form (parallel, limit to 50 entries each)
  const allLeads: Lead[] = [];
  const formBreakdown: Record<string, number> = {};
  const entryPromises = forms.map(async (form) => {
    try {
      const { data: entriesData, error: entriesError } = await gfFetch<{
        total_count: string;
        entries: GfEntry[];
      }>(`forms/${form.id}/entries`, {
        "paging[page_size]": "50",
        "sorting[key]": "date_created",
        "sorting[direction]": "DESC",
      });

      if (entriesError || !entriesData) return;

      const entries = entriesData.entries || [];
      let formCount = 0;

      for (const entry of entries) {
        if (isSpam(entry)) continue;

        const name = extractName(entry);
        const email = extractEmail(entry);
        if (!name && !email) continue;

        const lead: Lead = {
          id: `gf_${form.id}_${entry.id}`,
          source: "gravity_form",
          name,
          email,
          phone: extractPhone(entry),
          company: extractCompany(entry),
          message: extractMessage(entry),
          services: extractServices(entry),
          value: 0,
          status: "new",
          date: entry.date_created || new Date().toISOString(),
          meta: {
            form_id: form.id,
            form_title: form.title,
            entry_id: entry.id,
            source_url: entry.source_url || "",
          },
        };

        allLeads.push(lead);
        formCount++;
      }

      if (formCount > 0) {
        formBreakdown[form.title] = formCount;
      }
    } catch {
      // Skip individual form errors
    }
  });

  await Promise.all(entryPromises);

  return { leads: allLeads, formBreakdown, error: null };
}

// ---------------------------------------------------------------------------
// Source: WordPress Comments
// ---------------------------------------------------------------------------

interface WpComment {
  id: number;
  author_name: string;
  author_email: string;
  content: { rendered: string };
  date: string;
  status: string;
}

async function fetchComments(): Promise<{
  leads: Lead[];
  error: string | null;
}> {
  try {
    const res = await fetch(
      `${SITE_URL}/wp-json/wp/v2/comments?per_page=20&orderby=date&order=desc`,
      { signal: AbortSignal.timeout(10000), next: { revalidate: 0 } },
    );

    if (!res.ok) {
      if (res.status === 404) return { leads: [], error: null };
      return { leads: [], error: `WordPress comments returned ${res.status}` };
    }

    const data = (await res.json()) as WpComment[];

    const leads: Lead[] = data.map((comment) => ({
      id: `wp_comment_${comment.id}`,
      source: "comment" as LeadSource,
      name: comment.author_name || "",
      email: comment.author_email || "",
      phone: "",
      company: "",
      message: comment.content.rendered.replace(/<[^>]*>/g, "").trim(),
      services: [],
      value: 0,
      status: "new" as LeadStatus,
      date: comment.date,
      meta: { comment_status: comment.status },
    }));

    return { leads, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Comments fetch failed";
    return { leads: [], error: msg };
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source") || "all";

  const errors: string[] = [];
  let allLeads: Lead[] = [];
  const sources: SourceCounts = { forms: 0, comments: 0 };
  let formBreakdown: Record<string, number> = {};

  const shouldFetch = (s: string) => source === "all" || source === s;

  const [formsResult, commentsResult] = await Promise.all([
    shouldFetch("forms")
      ? fetchGravityForms()
      : Promise.resolve({ leads: [] as Lead[], formBreakdown: {} as Record<string, number>, error: null }),
    shouldFetch("comments")
      ? fetchComments()
      : Promise.resolve({ leads: [] as Lead[], error: null }),
  ]);

  // Aggregate
  if (formsResult.error) errors.push(formsResult.error);
  sources.forms = formsResult.leads.length;
  formBreakdown = formsResult.formBreakdown;
  allLeads = allLeads.concat(formsResult.leads);

  if (commentsResult.error) errors.push(commentsResult.error);
  sources.comments = commentsResult.leads.length;
  allLeads = allLeads.concat(commentsResult.leads);

  // Sort by date descending
  allLeads.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // If ALL sources failed, return error with details
  if (allLeads.length === 0 && errors.length > 0) {
    return NextResponse.json(
      {
        error: "Could not fetch leads from any source.",
        details: errors,
      },
      { status: 502 },
    );
  }

  const response: LeadsResponse = {
    leads: allLeads,
    total: allLeads.length,
    sources,
    formBreakdown,
  };

  return NextResponse.json({
    data: response,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
}
