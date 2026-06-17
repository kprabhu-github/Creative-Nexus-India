// Shared types for the Fixer module — generators that produce paste-ready
// SEO/GEO artifacts (llms.txt, robots.txt, schema, answer blocks, meta).

export type FixKind =
  | "llms_txt"
  | "robots_txt"
  | "schema_jsonld"
  | "answer_block"
  | "meta_rewrite";

export type FixOutputFormat = "text" | "html" | "jsonld" | "markdown";

export interface FixArtifact {
  id: string;
  org_id: string;
  kind: FixKind;
  title: string;
  input_json: Record<string, unknown>;
  output_text: string;
  output_format: FixOutputFormat;
  deployment_target: string | null;
  source_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const FIX_KIND_LABEL: Record<FixKind, string> = {
  llms_txt: "llms.txt",
  robots_txt: "robots.txt",
  schema_jsonld: "Schema (JSON-LD)",
  answer_block: "Answer Block",
  meta_rewrite: "Title + Meta",
};

export const CMS_TARGETS = [
  "wordpress",
  "shopify",
  "webflow",
  "framer",
  "wix",
  "squarespace",
  "custom",
] as const;
export type CmsTarget = (typeof CMS_TARGETS)[number];

export const CMS_LABEL: Record<CmsTarget, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  webflow: "Webflow",
  framer: "Framer",
  wix: "Wix",
  squarespace: "Squarespace",
  custom: "Custom code",
};

export const AI_CRAWLERS = [
  { agent: "GPTBot", vendor: "OpenAI", default: "allow" },
  { agent: "ClaudeBot", vendor: "Anthropic", default: "allow" },
  { agent: "PerplexityBot", vendor: "Perplexity", default: "allow" },
  { agent: "Google-Extended", vendor: "Google (Gemini training)", default: "allow" },
  { agent: "CCBot", vendor: "Common Crawl", default: "allow" },
  { agent: "Bytespider", vendor: "ByteDance / TikTok", default: "disallow" },
  { agent: "Amazonbot", vendor: "Amazon / Alexa", default: "allow" },
  { agent: "Applebot-Extended", vendor: "Apple Intelligence", default: "allow" },
] as const;
