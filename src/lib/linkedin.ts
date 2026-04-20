// ---------------------------------------------------------------------------
// LinkedIn domain helpers — map Apify output to our DB schema, defaults
// ---------------------------------------------------------------------------

import type { LinkedInProfileRaw, LinkedInCompanyRaw } from "@/lib/apify";

export const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// Default action limits per account type
export const DEFAULT_PERSONAL_LIMITS = {
  connections: 20,
  messages: 50,
  follows: 40,
  likes: 80,
  endorsements: 20,
};

export const DEFAULT_COMPANY_LIMITS = {
  inviteFollowers: 100,
  companyMessages: 20,
  postEngagement: 50,
  eventInvites: 50,
};

export const DEFAULT_PERSONAL_ACTIONS = [
  "follow",
  "visit",
  "endorse",
  "like",
  "connect",
  "message",
  "inmail",
];

export const DEFAULT_COMPANY_ACTIONS = [
  "invite_follow",
  "boost_post",
  "company_message",
  "event_invite",
  "employee_advocate",
];

export const DEFAULT_WORKING_HOURS = {
  from: "09:00",
  to: "18:00",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

// Parse numeric values that Apify returns as "3,933" strings or numbers
function toInt(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = parseFloat(cleaned);
    if (isFinite(n)) return Math.round(n);
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

/** Derive a URL-safe slug from a LinkedIn URL. */
export function slugFromUrl(url: string): string {
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^\/?#]+)/i);
  const raw = (match?.[1] ?? url).toLowerCase();
  return raw.replace(/[^a-z0-9-]/g, "-").slice(0, 60);
}

/** Determine account type from URL. */
export function typeFromUrl(url: string): "personal" | "company" {
  return /linkedin\.com\/company\//i.test(url) ? "company" : "personal";
}

/** Map raw Apify profile output → DB row shape. */
export function mapProfileToRow(
  url: string,
  raw: LinkedInProfileRaw | null,
  overrideName?: string,
) {
  const slug = slugFromUrl(url);
  const name =
    overrideName?.trim() ||
    firstString(raw?.fullName) ||
    "LinkedIn Profile";

  const location = firstString(
    raw?.addressWithCountry,
    raw?.addressWithoutCountry,
    raw?.location,
  );

  const pic =
    firstString(
      raw?.profilePicHighQuality,
      raw?.profilePicUrl,
      raw?.profilePic,
    ) ??
    (Array.isArray(raw?.profilePicAllDimensions) && raw?.profilePicAllDimensions.length > 0
      ? firstString(raw.profilePicAllDimensions[raw.profilePicAllDimensions.length - 1]?.url)
      : null);

  const bg =
    firstString(raw?.backgroundPic) ??
    (Array.isArray(raw?.backgroundPicAllDimensions) && raw?.backgroundPicAllDimensions.length > 0
      ? firstString(raw.backgroundPicAllDimensions[raw.backgroundPicAllDimensions.length - 1]?.url)
      : null);

  const skills = Array.isArray(raw?.skills)
    ? raw.skills
        .map((s) =>
          typeof s === "string" ? s : firstString(s?.title, s?.name),
        )
        .filter((v): v is string => typeof v === "string")
        .slice(0, 20)
    : [];

  const education = Array.isArray(raw?.educations) && raw?.educations.length > 0
    ? firstString(
        raw.educations[0]?.schoolName,
        raw.educations[0]?.title,
        raw.educations[0]?.subtitle,
      )
    : null;

  const experience = toInt(raw?.experience);

  return {
    slug,
    type: "personal" as const,
    url,
    name,
    headline: firstString(raw?.headline) ?? "",
    subline: firstString(raw?.subHeader, raw?.summary) ?? "",
    location: location ?? "",
    connections: toInt(raw?.connections),
    followers: toInt(raw?.followers) ?? 0,
    recommendations: toInt(raw?.recommendationsReceived),
    experience,
    pic,
    bg,
    verified: Boolean(raw?.isVerified),
    premium: Boolean(raw?.isPremium),
    skills,
    prev_companies: [] as string[],
    specialties: [] as string[],
    education,
    allowed_actions: DEFAULT_PERSONAL_ACTIONS,
    daily_limits: DEFAULT_PERSONAL_LIMITS,
    working_hours: DEFAULT_WORKING_HOURS,
    status: "ready" as const,
    role: "Personal outreach — connection requests, direct messages, endorsements, profile warm-up",
    scraped_at: new Date().toISOString(),
    raw_apify: raw as unknown as Record<string, unknown> | null,
  };
}

/** Map raw Apify company output → DB row shape. */
export function mapCompanyToRow(
  url: string,
  raw: LinkedInCompanyRaw | null,
  overrideName?: string,
) {
  const slug = slugFromUrl(url);
  const name =
    overrideName?.trim() ||
    firstString(raw?.name, raw?.title) ||
    "Company Page";

  const hq = raw?.headquartersAddress ?? raw?.headquarter;
  const location =
    firstString(hq?.line1, hq?.city) ??
    firstString(hq?.country);

  const pic = firstString(raw?.logoResolutionResult, raw?.logoUrl, raw?.logo);

  return {
    slug,
    type: "company" as const,
    url,
    name,
    headline:
      firstString(raw?.tagline, raw?.headline, raw?.description) ?? "",
    subline:
      firstString(raw?.industry) ??
      (Array.isArray(raw?.industries) ? raw.industries.join(" · ") : "") ??
      "",
    location: location ?? "",
    connections: null,
    followers: toInt(raw?.followerCount ?? raw?.followers) ?? 0,
    employee_count: toInt(raw?.employeeCount ?? raw?.staffCount),
    founded: toInt(raw?.foundedYear ?? raw?.founded),
    company_size: firstString(raw?.companySize, raw?.staffCountRange),
    pic,
    specialties: Array.isArray(raw?.specialties) ? raw.specialties.slice(0, 20) : [],
    allowed_actions: DEFAULT_COMPANY_ACTIONS,
    daily_limits: DEFAULT_COMPANY_LIMITS,
    working_hours: DEFAULT_WORKING_HOURS,
    status: "ready" as const,
    role: "Company page — grow followers, company awareness, post engagement, event invitations",
    scraped_at: new Date().toISOString(),
    raw_apify: raw as unknown as Record<string, unknown> | null,
  };
}

// ---------------------------------------------------------------------------
// Prospect discovery — runs different Apify actors per source type
// ---------------------------------------------------------------------------

/** Map UI source id → Apify actor. `null` = not yet supported (manual/CSV). */
export const SOURCE_ACTORS: Record<string, string | null> = {
  company_employees: "george.the.developer/linkedin-company-employees-scraper",
  post_likers: "harvestapi/linkedin-profile-reactions",
  post_commenters: "harvestapi/linkedin-profile-comments",
  linkedin_search: null,
  group_members: null,
  event_attendees: null,
  connections: null,
  alumni: null,
  csv_import: null,
};

export interface ProspectRaw {
  name?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  publicIdentifier?: string;
  headline?: string;
  jobTitle?: string;
  title?: string;
  profileUrl?: string;
  url?: string;
  linkedinUrl?: string;
  profileUrn?: string;
  company?: string;
  companyName?: string;
  currentCompany?: string | { name?: string; title?: string };
  industry?: string;
  location?: string;
  locationName?: string;
  email?: string;
  primaryEmail?: string;
  [k: string]: unknown;
}

function firstStr(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

/** Map a raw Apify prospect output to our DB row shape. */
export function mapProspectToRow(
  campaignId: string,
  raw: ProspectRaw,
): {
  campaign_id: string;
  name: string;
  first_name: string;
  headline: string;
  company: string;
  industry: string;
  location: string;
  profile_url: string | null;
  email: string | null;
  score: number;
  step: number;
  status: "pending";
  reply_received: boolean;
  raw_apify: Record<string, unknown>;
} {
  // Extract name — actors use any of: fullName, name, firstName+lastName, publicIdentifier
  const fullName =
    firstStr(raw.fullName, raw.name) ||
    `${firstStr(raw.firstName)} ${firstStr(raw.lastName)}`.trim() ||
    firstStr(raw.publicIdentifier).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Unknown";
  const firstName = firstStr(raw.firstName, fullName.split(" ")[0]);

  // URL — actors use any of: profileUrl, url, linkedinUrl, build from publicIdentifier
  let profileUrl = firstStr(raw.profileUrl, raw.url, raw.linkedinUrl) || null;
  if (!profileUrl && raw.publicIdentifier) {
    profileUrl = `https://www.linkedin.com/in/${firstStr(raw.publicIdentifier)}/`;
  }

  // Company — can be string OR object { name, title }
  let company = "";
  if (typeof raw.currentCompany === "string") {
    company = raw.currentCompany;
  } else if (raw.currentCompany && typeof raw.currentCompany === "object") {
    company = firstStr(raw.currentCompany.name);
  }
  company = company || firstStr(raw.company, raw.companyName);

  // Headline — actors use any of: headline, jobTitle, title, or title inside currentCompany
  let headline = firstStr(raw.headline, raw.jobTitle, raw.title);
  if (!headline && raw.currentCompany && typeof raw.currentCompany === "object") {
    headline = firstStr(raw.currentCompany.title);
  }

  const location = firstStr(raw.location, raw.locationName);
  const email = firstStr(raw.email, raw.primaryEmail) || null;

  // Simple scoring: has email +20, has headline +10, base 60
  let score = 60;
  if (email) score += 20;
  if (headline) score += 10;
  score = Math.min(Math.max(score, 0), 100);

  return {
    campaign_id: campaignId,
    name: fullName,
    first_name: firstName || fullName.split(" ")[0],
    headline,
    company,
    industry: firstStr(raw.industry),
    location,
    profile_url: profileUrl,
    email,
    score,
    step: 0,
    status: "pending" as const,
    reply_received: false,
    raw_apify: raw as unknown as Record<string, unknown>,
  };
}

export interface DiscoverOptions {
  source: string;
  sourceUrl: string;
  campaignId: string;
  maxResults?: number;
}

/**
 * Run the right Apify actor for a given source. Returns raw prospect rows.
 * Throws if the source isn't supported or the actor fails.
 */
export async function discoverProspects(
  options: DiscoverOptions,
): Promise<ProspectRaw[]> {
  const actorId = SOURCE_ACTORS[options.source];
  if (!actorId) {
    throw new Error(
      `Source "${options.source}" is not automated yet — use CSV import or paste a URL list.`,
    );
  }

  const { startRun, waitForRun, getDatasetItems } = await import("@/lib/apify");

  const maxResults = options.maxResults ?? 30;
  // Each Apify actor has its own input schema — this map MUST match the actor's
  // documented schema exactly or it silently returns 0 items (or 400s).
  const inputs: Record<string, Record<string, unknown>> = {
    // Input schema: https://apify.com/george.the.developer/linkedin-company-employees-scraper
    "george.the.developer/linkedin-company-employees-scraper": {
      companies: [options.sourceUrl],
      maxEmployees: maxResults,
    },
    // harvestapi actors — post URL + max items
    "harvestapi/linkedin-profile-reactions": {
      postUrls: [options.sourceUrl],
      maxItems: maxResults,
    },
    "harvestapi/linkedin-profile-comments": {
      postUrls: [options.sourceUrl],
      maxItems: maxResults,
    },
  };

  const input = inputs[actorId] ?? {
    startUrls: [{ url: options.sourceUrl }],
    maxResults,
  };

  const run = await startRun({
    actorId,
    input,
    timeoutSecs: 180,
    memoryMbytes: 2048,
  });

  const completed = await waitForRun(run.id, 240_000);
  const items = await getDatasetItems<ProspectRaw>(completed.defaultDatasetId, {
    limit: maxResults,
  });
  return items;
}

/** Scrape and map a LinkedIn URL. Returns row ready to insert/upsert. */
export async function scrapeLinkedInUrl(
  url: string,
  overrideName?: string,
): Promise<ReturnType<typeof mapProfileToRow> | ReturnType<typeof mapCompanyToRow>> {
  const { scrapeLinkedInProfile, scrapeLinkedInCompany } = await import("@/lib/apify");

  if (typeFromUrl(url) === "company") {
    const raw = await scrapeLinkedInCompany(url);
    return mapCompanyToRow(url, raw, overrideName);
  }
  const raw = await scrapeLinkedInProfile(url);
  return mapProfileToRow(url, raw, overrideName);
}
