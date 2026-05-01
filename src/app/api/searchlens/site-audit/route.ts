// ---------------------------------------------------------------------------
// POST /api/searchlens/site-audit — AI Search Site Audit
// ---------------------------------------------------------------------------
// Inspects a domain's AI-bot crawlability. Performs server-side fetches for
// llms.txt, robots.txt, sitemap.xml, and homepage HTML to evaluate schema,
// meta tags, OG tags, and canonical link. Computes a weighted overall score.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 50 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; CNX-SearchLens-Audit/1.0)";

const AI_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
] as const;

const WEIGHTS: Record<string, number> = {
  llms_txt: 0.2,
  robots_txt: 0.25,
  schema_org: 0.2,
  sitemap: 0.1,
  meta_description: 0.1,
  title_tag: 0.05,
  og_tags: 0.05,
  canonical: 0.05,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  score: number;
  detail: string;
  remediation?: string;
  raw?: string;
}

interface FetchOk {
  ok: true;
  status: number;
  body: string;
  url: string;
}

interface FetchErr {
  ok: false;
  status: number;
  error: string;
  url: string;
}

type FetchResult = FetchOk | FetchErr;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const InputSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(255)
    .transform((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .refine((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d), {
      message: "Invalid domain format",
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeFetch(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      redirect: "follow",
    });
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const body = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    return { ok: true, status: res.status, body, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: message, url };
  } finally {
    clearTimeout(timer);
  }
}

function statusToScore(status: CheckStatus): number {
  if (status === "pass") return 100;
  if (status === "warn") return 50;
  return 0;
}

function snippet(text: string, n = 500): string {
  return text.length > n ? text.slice(0, n) : text;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkLlmsTxt(res: FetchResult): CheckResult {
  if (!res.ok) {
    return {
      id: "llms_txt",
      label: "llms.txt",
      status: "fail",
      score: 0,
      detail: `Could not fetch ${res.url}: ${res.error}`,
      remediation:
        "Create an /llms.txt file at the root of your domain summarising your site for LLMs.",
    };
  }
  if (res.status === 200 && res.body.trim().length > 0) {
    return {
      id: "llms_txt",
      label: "llms.txt",
      status: "pass",
      score: 100,
      detail: "Found llms.txt with content. AI crawlers can use it as a guide.",
      raw: snippet(res.body),
    };
  }
  return {
    id: "llms_txt",
    label: "llms.txt",
    status: "fail",
    score: 0,
    detail: `No llms.txt found (HTTP ${res.status}).`,
    remediation:
      "Add an /llms.txt file (see llmstxt.org) describing your most important pages for AI ingestion.",
  };
}

function checkRobotsTxt(res: FetchResult): CheckResult {
  if (!res.ok) {
    return {
      id: "robots_txt",
      label: "robots.txt — AI bot rules",
      status: "fail",
      score: 0,
      detail: `Could not fetch ${res.url}: ${res.error}`,
      remediation: "Add a /robots.txt file with explicit rules for AI bots.",
    };
  }
  if (res.status !== 200) {
    return {
      id: "robots_txt",
      label: "robots.txt — AI bot rules",
      status: "warn",
      score: 50,
      detail: `robots.txt missing (HTTP ${res.status}). Default-allow assumed but unclear.`,
      remediation:
        "Publish a /robots.txt with explicit Allow rules for GPTBot, ClaudeBot, PerplexityBot, Google-Extended.",
    };
  }

  const body = res.body;
  const lines = body.split(/\r?\n/);
  const blocked: string[] = [];
  const allowed: string[] = [];

  for (const bot of AI_BOTS) {
    let inAgentBlock = false;
    let sawDisallowAll = false;
    let sawAllow = false;
    for (const rawLine of lines) {
      const line = rawLine.split("#")[0].trim();
      if (!line) continue;
      const lower = line.toLowerCase();
      if (lower.startsWith("user-agent:")) {
        const ua = line.slice("user-agent:".length).trim();
        inAgentBlock = ua.toLowerCase() === bot.toLowerCase();
        continue;
      }
      if (!inAgentBlock) continue;
      if (lower.startsWith("disallow:")) {
        const path = line.slice("disallow:".length).trim();
        if (path === "/") sawDisallowAll = true;
      }
      if (lower.startsWith("allow:")) sawAllow = true;
    }
    if (sawDisallowAll) blocked.push(bot);
    else if (sawAllow) allowed.push(bot);
  }

  if (blocked.length > 0) {
    return {
      id: "robots_txt",
      label: "robots.txt — AI bot rules",
      status: "fail",
      score: 0,
      detail: `AI bots explicitly blocked: ${blocked.join(", ")}.`,
      remediation:
        "Remove `Disallow: /` for these user-agents if you want AI search visibility.",
      raw: snippet(body),
    };
  }
  if (allowed.length === AI_BOTS.length) {
    return {
      id: "robots_txt",
      label: "robots.txt — AI bot rules",
      status: "pass",
      score: 100,
      detail: `All major AI bots (${AI_BOTS.join(", ")}) explicitly allowed.`,
      raw: snippet(body),
    };
  }
  return {
    id: "robots_txt",
    label: "robots.txt — AI bot rules",
    status: "warn",
    score: 50,
    detail:
      "robots.txt has no explicit rules for some AI bots — defaults apply, which can be ambiguous.",
    remediation:
      "Add explicit Allow rules for GPTBot, ClaudeBot, PerplexityBot, Google-Extended to remove ambiguity.",
    raw: snippet(body),
  };
}

function checkSitemap(res: FetchResult): CheckResult {
  if (!res.ok) {
    return {
      id: "sitemap",
      label: "sitemap.xml",
      status: "fail",
      score: 0,
      detail: `Could not fetch ${res.url}: ${res.error}`,
      remediation: "Generate and publish a sitemap.xml at your domain root.",
    };
  }
  if (
    res.status === 200 &&
    (res.body.includes("<urlset") || res.body.includes("<sitemapindex"))
  ) {
    return {
      id: "sitemap",
      label: "sitemap.xml",
      status: "pass",
      score: 100,
      detail: "Valid sitemap.xml present at root.",
    };
  }
  return {
    id: "sitemap",
    label: "sitemap.xml",
    status: "fail",
    score: 0,
    detail: `No valid sitemap at /sitemap.xml (HTTP ${res.status}).`,
    remediation: "Publish sitemap.xml at the domain root with <urlset> entries.",
  };
}

function checkSchemaOrg(html: string): CheckResult {
  const ldJsonRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = ldJsonRegex.exec(html)) !== null) blocks.push(match[1]);

  if (blocks.length === 0) {
    return {
      id: "schema_org",
      label: "Schema.org structured data",
      status: "fail",
      score: 0,
      detail: "No JSON-LD schema found on homepage.",
      remediation:
        "Add Organization and WebSite JSON-LD schema to your homepage <head>.",
    };
  }
  const joined = blocks.join("\n").toLowerCase();
  const hasKey = /"@type"\s*:\s*"(organization|website)"/i.test(joined);
  if (hasKey) {
    return {
      id: "schema_org",
      label: "Schema.org structured data",
      status: "pass",
      score: 100,
      detail: `${blocks.length} JSON-LD block(s) found, including Organization or WebSite.`,
      raw: snippet(blocks[0]),
    };
  }
  return {
    id: "schema_org",
    label: "Schema.org structured data",
    status: "warn",
    score: 50,
    detail: `${blocks.length} JSON-LD block(s) found but no Organization/WebSite type.`,
    remediation:
      "Add Organization and WebSite JSON-LD entries so AI engines can identify your brand.",
    raw: snippet(blocks[0]),
  };
}

function checkMetaDescription(html: string): CheckResult {
  const m = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
  );
  if (!m) {
    return {
      id: "meta_description",
      label: "Meta description",
      status: "warn",
      score: 50,
      detail: "No <meta name=\"description\"> tag found on homepage.",
      remediation: "Add a 50–160 character meta description to your homepage <head>.",
    };
  }
  const len = m[1].length;
  if (len >= 50 && len <= 160) {
    return {
      id: "meta_description",
      label: "Meta description",
      status: "pass",
      score: 100,
      detail: `Meta description present (${len} chars).`,
      raw: m[1],
    };
  }
  return {
    id: "meta_description",
    label: "Meta description",
    status: "warn",
    score: 50,
    detail: `Meta description length ${len} chars (recommended 50–160).`,
    remediation: "Tighten the description to fall within 50–160 characters.",
    raw: m[1],
  };
}

function checkTitleTag(html: string): CheckResult {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) {
    return {
      id: "title_tag",
      label: "Title tag",
      status: "fail",
      score: 0,
      detail: "No <title> tag found on homepage.",
      remediation: "Add a descriptive 10–65 character <title> tag.",
    };
  }
  const text = m[1].trim();
  const len = text.length;
  if (len >= 10 && len <= 65) {
    return {
      id: "title_tag",
      label: "Title tag",
      status: "pass",
      score: 100,
      detail: `Title present (${len} chars).`,
      raw: text,
    };
  }
  return {
    id: "title_tag",
    label: "Title tag",
    status: "warn",
    score: 50,
    detail: `Title length ${len} chars (recommended 10–65).`,
    remediation: "Adjust the <title> length to between 10 and 65 characters.",
    raw: text,
  };
}

function checkOgTags(html: string): CheckResult {
  const has = (prop: string): boolean =>
    new RegExp(
      `<meta[^>]+property=["']${prop}["'][^>]+content=["'][^"']+["']`,
      "i",
    ).test(html);
  const present: string[] = [];
  const missing: string[] = [];
  for (const tag of ["og:title", "og:description", "og:image"]) {
    if (has(tag)) present.push(tag);
    else missing.push(tag);
  }
  if (missing.length === 0) {
    return {
      id: "og_tags",
      label: "Open Graph tags",
      status: "pass",
      score: 100,
      detail: "og:title, og:description, og:image all present.",
    };
  }
  return {
    id: "og_tags",
    label: "Open Graph tags",
    status: missing.length === 3 ? "fail" : "warn",
    score: missing.length === 3 ? 0 : 50,
    detail: `Missing: ${missing.join(", ")}.`,
    remediation: "Add the missing Open Graph meta tags to your homepage <head>.",
  };
}

function checkCanonical(html: string): CheckResult {
  const m = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  );
  if (m) {
    return {
      id: "canonical",
      label: "Canonical link",
      status: "pass",
      score: 100,
      detail: "Canonical link element present.",
      raw: m[1],
    };
  }
  return {
    id: "canonical",
    label: "Canonical link",
    status: "fail",
    score: 0,
    detail: "No <link rel=\"canonical\"> tag on homepage.",
    remediation: "Add <link rel=\"canonical\" href=\"...\"> to the homepage <head>.",
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const domain = parsed.data.domain;
    const base = `https://${domain}`;

    const [llmsRes, robotsRes, sitemapRes, homeRes] = await Promise.all([
      safeFetch(`${base}/llms.txt`),
      safeFetch(`${base}/robots.txt`),
      safeFetch(`${base}/sitemap.xml`),
      safeFetch(`${base}/`),
    ]);

    const homeHtml = homeRes.ok ? homeRes.body : "";

    const checks: CheckResult[] = [
      checkLlmsTxt(llmsRes),
      checkRobotsTxt(robotsRes),
      checkSitemap(sitemapRes),
      homeRes.ok
        ? checkSchemaOrg(homeHtml)
        : {
            id: "schema_org",
            label: "Schema.org structured data",
            status: "fail",
            score: 0,
            detail: `Could not fetch ${homeRes.url}: ${homeRes.error}`,
          },
      homeRes.ok
        ? checkMetaDescription(homeHtml)
        : {
            id: "meta_description",
            label: "Meta description",
            status: "fail",
            score: 0,
            detail: `Could not fetch homepage: ${homeRes.error}`,
          },
      homeRes.ok
        ? checkTitleTag(homeHtml)
        : {
            id: "title_tag",
            label: "Title tag",
            status: "fail",
            score: 0,
            detail: `Could not fetch homepage: ${homeRes.error}`,
          },
      homeRes.ok
        ? checkOgTags(homeHtml)
        : {
            id: "og_tags",
            label: "Open Graph tags",
            status: "fail",
            score: 0,
            detail: `Could not fetch homepage: ${homeRes.error}`,
          },
      homeRes.ok
        ? checkCanonical(homeHtml)
        : {
            id: "canonical",
            label: "Canonical link",
            status: "fail",
            score: 0,
            detail: `Could not fetch homepage: ${homeRes.error}`,
          },
    ];

    let weightedSum = 0;
    let weightTotal = 0;
    for (const c of checks) {
      const w = WEIGHTS[c.id] ?? 0;
      weightedSum += statusToScore(c.status) * w;
      weightTotal += w;
    }
    const overall_score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

    return NextResponse.json({
      data: {
        domain,
        fetched_at: new Date().toISOString(),
        overall_score,
        checks,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/searchlens/site-audit error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
