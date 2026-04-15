// ---------------------------------------------------------------------------
// Apify REST API wrapper — raw fetch, no SDK
// ---------------------------------------------------------------------------
// Docs: https://docs.apify.com/api/v2
// ---------------------------------------------------------------------------

const APIFY_BASE_URL = "https://api.apify.com/v2";

/** Well-known actor IDs used across the platform. */
export const APIFY_ACTORS = {
  websiteCrawler: "apify/website-content-crawler",
  ragBrowser: "apify/rag-web-browser",
  instagramScraper: "apify/instagram-scraper",
  twitterScraper: "apify/tweet-scraper",
  linkedinScraper: "apify/linkedin-profile-scraper",
  googleSearch: "apify/google-search-scraper",
} as const;

export type ApifyActorKey = keyof typeof APIFY_ACTORS;

/** Shape of a run status response from the Apify API. */
interface ApifyRunInfo {
  id: string;
  status: string;
  defaultDatasetId: string;
  startedAt: string;
  finishedAt: string | null;
  statusMessage: string | null;
}

interface ApifyRunResponse {
  data: ApifyRunInfo;
}

interface ApifyDatasetResponse<T> {
  data?: T[];
}

interface StartRunOptions {
  /** The actor ID (e.g. "apify/website-content-crawler"). */
  actorId: string;
  /** Input to pass to the actor. */
  input: Record<string, unknown>;
  /** Timeout in seconds to wait for completion. Defaults to 120. */
  timeoutSecs?: number;
  /** Memory in MB to allocate. Defaults to 1024. */
  memoryMbytes?: number;
}

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not set in environment variables");
  }
  return token;
}

/**
 * Start an Apify actor run and return the run info.
 */
async function startRun(options: StartRunOptions): Promise<ApifyRunInfo> {
  const { actorId, input, timeoutSecs = 120, memoryMbytes = 1024 } = options;
  const token = getToken();

  const encodedActorId = actorId.replace("/", "~");
  const url = `${APIFY_BASE_URL}/acts/${encodedActorId}/runs?timeout=${timeoutSecs}&memory=${memoryMbytes}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Apify start run failed (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const result = (await response.json()) as ApifyRunResponse;
  return result.data;
}

/**
 * Poll an Apify run until it reaches a terminal state (SUCCEEDED, FAILED,
 * ABORTED, TIMED-OUT). Polls every 3 seconds up to maxWaitMs.
 */
async function waitForRun(
  runId: string,
  maxWaitMs: number = 300_000,
): Promise<ApifyRunInfo> {
  const token = getToken();
  const startTime = Date.now();

  const TERMINAL_STATES = new Set([
    "SUCCEEDED",
    "FAILED",
    "ABORTED",
    "TIMED-OUT",
  ]);

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(
        `Apify run status check failed (${response.status})`,
      );
    }

    const result = (await response.json()) as ApifyRunResponse;
    const run = result.data;

    if (TERMINAL_STATES.has(run.status)) {
      if (run.status !== "SUCCEEDED") {
        throw new Error(
          `Apify run ${runId} ended with status: ${run.status}. Message: ${run.statusMessage ?? "none"}`,
        );
      }
      return run;
    }

    // Wait 3 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(
    `Apify run ${runId} timed out after ${Math.round(maxWaitMs / 1000)}s`,
  );
}

/**
 * Retrieve items from an Apify dataset.
 */
async function getDatasetItems<T = Record<string, unknown>>(
  datasetId: string,
  options?: { limit?: number; offset?: number },
): Promise<T[]> {
  const token = getToken();
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const url = `${APIFY_BASE_URL}/datasets/${datasetId}/items?limit=${limit}&offset=${offset}&format=json`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Apify dataset fetch failed (${response.status})`,
    );
  }

  // The items endpoint returns an array directly, not wrapped in { data: [...] }
  const items = (await response.json()) as T[] | ApifyDatasetResponse<T>;
  if (Array.isArray(items)) {
    return items;
  }
  return items.data ?? [];
}

// ---------------------------------------------------------------------------
// High-level convenience functions
// ---------------------------------------------------------------------------

export interface CrawlWebsiteOptions {
  /** URL(s) to crawl. */
  startUrls: string[];
  /** Max pages to crawl. Defaults to 10. */
  maxCrawlPages?: number;
  /** Max depth. Defaults to 1. */
  maxCrawlDepth?: number;
}

export interface CrawlResult {
  url: string;
  title?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * Crawl a website using Apify's website-content-crawler and return the
 * extracted text content from each page.
 */
export async function crawlWebsite(
  options: CrawlWebsiteOptions,
): Promise<CrawlResult[]> {
  const { startUrls, maxCrawlPages = 10, maxCrawlDepth = 1 } = options;

  const input = {
    startUrls: startUrls.map((url) => ({ url })),
    maxCrawlPages,
    maxCrawlDepth,
    crawlerType: "cheerio",
    includeUrlGlobs: [],
    excludeUrlGlobs: [],
    removeCookieWarnings: true,
    removeElementsCssSelector:
      "nav, footer, header, .cookie-banner, .advertisement, script, style",
  };

  const run = await startRun({
    actorId: APIFY_ACTORS.websiteCrawler,
    input,
    timeoutSecs: 120,
    memoryMbytes: 1024,
  });

  const completedRun = await waitForRun(run.id, 180_000);

  const items = await getDatasetItems<{
    url: string;
    title?: string;
    text?: string;
    markdown?: string;
    metadata?: Record<string, unknown>;
  }>(completedRun.defaultDatasetId, { limit: maxCrawlPages });

  return items.map((item) => ({
    url: item.url,
    title: item.title,
    text: item.text ?? item.markdown ?? "",
    metadata: item.metadata,
  }));
}

export interface RagBrowseOptions {
  /** Search query or URL. */
  query: string;
  /** Max results. Defaults to 5. */
  maxResults?: number;
}

/**
 * Use the RAG Web Browser actor for search-and-extract tasks.
 */
export async function ragBrowse(
  options: RagBrowseOptions,
): Promise<CrawlResult[]> {
  const { query, maxResults = 5 } = options;

  const input = {
    query,
    maxResults,
  };

  const run = await startRun({
    actorId: APIFY_ACTORS.ragBrowser,
    input,
    timeoutSecs: 60,
    memoryMbytes: 512,
  });

  const completedRun = await waitForRun(run.id, 120_000);

  const items = await getDatasetItems<{
    url: string;
    title?: string;
    text?: string;
    markdown?: string;
    metadata?: Record<string, unknown>;
  }>(completedRun.defaultDatasetId, { limit: maxResults });

  return items.map((item) => ({
    url: item.url,
    title: item.title,
    text: item.text ?? item.markdown ?? "",
    metadata: item.metadata,
  }));
}

export interface ScrapeInstagramOptions {
  /** Instagram usernames to scrape (without @). */
  usernames: string[];
  /** Max posts per profile. Defaults to 12. */
  resultsLimit?: number;
}

/**
 * Scrape Instagram profiles and posts.
 */
export async function scrapeInstagram(
  options: ScrapeInstagramOptions,
): Promise<Record<string, unknown>[]> {
  const { usernames, resultsLimit = 12 } = options;

  const input = {
    directUrls: usernames.map(
      (u) => `https://www.instagram.com/${u}/`,
    ),
    resultsLimit,
    resultsType: "posts",
    searchType: "user",
  };

  const run = await startRun({
    actorId: APIFY_ACTORS.instagramScraper,
    input,
    timeoutSecs: 120,
    memoryMbytes: 1024,
  });

  const completedRun = await waitForRun(run.id, 180_000);

  return getDatasetItems(completedRun.defaultDatasetId, {
    limit: resultsLimit * usernames.length,
  });
}
