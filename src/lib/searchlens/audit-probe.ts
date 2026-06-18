// Probe a public site for GEO-readiness signals. Pure fetch, no LLM —
// every call returns deterministic pass/fail per signal so the UI can score
// 0–5 in <2s. Failures roll up to a recommended fix kind.

import type { FixKind } from "@/lib/searchlens/fix-types";

export type AuditSignal =
  | "llms_txt_present"
  | "robots_ai_rules"
  | "faq_schema"
  | "answer_block"
  | "meta_quality";

export type AuditStatus = "pass" | "fail" | "partial" | "unknown";

export interface AuditResult {
  signal: AuditSignal;
  status: AuditStatus;
  details: Record<string, unknown>;
  recommends: FixKind | null;
}

const AI_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
];

const UA = "CNX-SearchLens-Audit/1.0 (+https://app.creativenexus.in)";

function normalizeOrigin(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  return `${u.protocol}//${u.host}`;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; text: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ac.signal, redirect: "follow" });
    const text = r.ok ? await r.text() : "";
    return { ok: r.ok, status: r.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(t);
  }
}

async function probeLlmsTxt(origin: string): Promise<AuditResult> {
  const r = await fetchText(`${origin}/llms.txt`);
  if (r.ok && r.text.length > 50 && /^#\s+/m.test(r.text)) {
    return { signal: "llms_txt_present", status: "pass", details: { bytes: r.text.length }, recommends: null };
  }
  if (r.status === 200 && r.text.length > 0) {
    return { signal: "llms_txt_present", status: "partial", details: { bytes: r.text.length, reason: "present but does not follow spec" }, recommends: "llms_txt" };
  }
  return { signal: "llms_txt_present", status: "fail", details: { status: r.status }, recommends: "llms_txt" };
}

async function probeRobots(origin: string): Promise<AuditResult> {
  const r = await fetchText(`${origin}/robots.txt`);
  if (!r.ok) return { signal: "robots_ai_rules", status: "fail", details: { status: r.status }, recommends: "robots_txt" };
  const present = AI_BOTS.filter((b) => new RegExp(`User-agent:\\s*${b}`, "i").test(r.text));
  if (present.length === 0) {
    return { signal: "robots_ai_rules", status: "fail", details: { found: [] }, recommends: "robots_txt" };
  }
  if (present.length >= 3) {
    return { signal: "robots_ai_rules", status: "pass", details: { found: present }, recommends: null };
  }
  return { signal: "robots_ai_rules", status: "partial", details: { found: present, missing: AI_BOTS.filter((b) => !present.includes(b)) }, recommends: "robots_txt" };
}

function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      out.push(JSON.parse(raw));
    } catch {
      // skip
    }
  }
  return out;
}

function findFaqPage(blocks: unknown[]): boolean {
  const has = (o: unknown): boolean => {
    if (!o || typeof o !== "object") return false;
    const t = (o as Record<string, unknown>)["@type"];
    if (typeof t === "string" && t.toLowerCase() === "faqpage") return true;
    if (Array.isArray(t) && t.some((x) => typeof x === "string" && x.toLowerCase() === "faqpage")) return true;
    const graph = (o as Record<string, unknown>)["@graph"];
    if (Array.isArray(graph) && graph.some(has)) return true;
    return false;
  };
  return blocks.some(has);
}

async function probeFaqAndAnswer(origin: string): Promise<{ faq: AuditResult; answer: AuditResult; meta: AuditResult }> {
  const r = await fetchText(origin);
  if (!r.ok) {
    const fail = (signal: AuditSignal, recommends: FixKind): AuditResult => ({ signal, status: "unknown", details: { status: r.status }, recommends });
    return {
      faq: fail("faq_schema", "schema_jsonld"),
      answer: fail("answer_block", "answer_block"),
      meta: fail("meta_quality", "meta_rewrite"),
    };
  }
  const html = r.text;
  const blocks = extractJsonLd(html);
  const hasFaq = findFaqPage(blocks);
  const faq: AuditResult = hasFaq
    ? { signal: "faq_schema", status: "pass", details: { jsonld_blocks: blocks.length }, recommends: null }
    : { signal: "faq_schema", status: "fail", details: { jsonld_blocks: blocks.length }, recommends: "schema_jsonld" };

  // Answer-block heuristic: any first paragraph 60–800 chars near top of body.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const firstP = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const para = firstP ? firstP[1].replace(/<[^>]+>/g, "").trim() : "";
  const paraLen = para.length;
  const answer: AuditResult =
    paraLen >= 120 && paraLen <= 1200
      ? { signal: "answer_block", status: "pass", details: { first_para_len: paraLen }, recommends: null }
      : paraLen > 0
        ? { signal: "answer_block", status: "partial", details: { first_para_len: paraLen, reason: paraLen < 120 ? "too short to cite" : "too long for citation" }, recommends: "answer_block" }
        : { signal: "answer_block", status: "fail", details: { reason: "no leading paragraph" }, recommends: "answer_block" };

  // Meta quality: title 30–60, description 120–160.
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const desc = descMatch ? descMatch[1].trim() : "";
  const titleOk = title.length >= 25 && title.length <= 70;
  const descOk = desc.length >= 110 && desc.length <= 170;
  const meta: AuditResult =
    titleOk && descOk
      ? { signal: "meta_quality", status: "pass", details: { title_len: title.length, desc_len: desc.length }, recommends: null }
      : !title && !desc
        ? { signal: "meta_quality", status: "fail", details: { title_len: title.length, desc_len: desc.length }, recommends: "meta_rewrite" }
        : { signal: "meta_quality", status: "partial", details: { title_len: title.length, desc_len: desc.length, title_ok: titleOk, desc_ok: descOk }, recommends: "meta_rewrite" };

  return { faq, answer, meta };
}

export interface SiteAuditReport {
  site_url: string;
  origin: string;
  score: number; // 0–5
  results: AuditResult[];
  generated_at: string;
}

export async function runSiteAudit(input: string): Promise<SiteAuditReport> {
  const origin = normalizeOrigin(input);
  const [llms, robots, page] = await Promise.all([
    probeLlmsTxt(origin),
    probeRobots(origin),
    probeFaqAndAnswer(origin),
  ]);
  const results: AuditResult[] = [llms, robots, page.faq, page.answer, page.meta];
  const score = results.reduce((acc, r) => acc + (r.status === "pass" ? 1 : r.status === "partial" ? 0.5 : 0), 0);
  return {
    site_url: input,
    origin,
    score: Math.round(score * 10) / 10,
    results,
    generated_at: new Date().toISOString(),
  };
}
