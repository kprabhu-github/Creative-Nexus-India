// POST /api/searchlens/fix/meta-rewrite
// Generates 3 title-tag + meta-description variants for a page, optimized
// for AI search citation + traditional SERP CTR. Returns JSON-parseable
// variants so the UI can render them as side-by-side cards.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import type { FixArtifact } from "@/lib/searchlens/fix-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const Schema = z.object({
  page_url: z.string().url(),
  current_title: z.string().trim().max(300).optional(),
  current_meta: z.string().trim().max(500).optional(),
  primary_keyword: z.string().trim().min(1).max(120),
  brand_name: z.string().trim().min(1).max(120),
  audience: z.string().trim().max(200).optional(),
  cms: z.string().trim().max(40).optional(),
});

interface Variant {
  label: string;
  title: string;
  meta: string;
  rationale: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;

  const systemPrompt = `You are an SEO + GEO copywriter generating title-tag and meta-description variants. Output ONLY valid JSON in this exact shape:
{
  "variants": [
    { "label": "string ≤ 30 chars", "title": "string ≤ 60 chars", "meta": "string 140–155 chars", "rationale": "string ≤ 200 chars" }
  ]
}
Generate exactly 3 variants:
1. "Search-optimized" — keyword early, brand at end, action verb
2. "Curiosity-driven" — question or pattern interrupt, then keyword
3. "AI-citation-ready" — first 15 words answer the implied query so AI engines can quote directly`;

  const userMessage = `Page: ${p.page_url}
Brand: ${p.brand_name}
Primary keyword: ${p.primary_keyword}
${p.audience ? `Audience: ${p.audience}` : ""}
${p.current_title ? `Current title: ${p.current_title}` : ""}
${p.current_meta ? `Current meta: ${p.current_meta}` : ""}

Generate the 3 variants now.`;

  const response = await callClaude({
    tier: "execution",
    systemPrompt,
    userMessage,
    maxTokens: 1500,
    temperature: 0.6,
  });

  let variants: Variant[];
  try {
    const json = parseClaudeJson<{ variants: Variant[] }>(response.text);
    variants = json.variants ?? [];
    if (variants.length === 0) throw new Error("no variants");
  } catch (e) {
    return NextResponse.json(
      { error: `LLM returned invalid JSON: ${(e as Error).message}`, raw: response.text },
      { status: 502 },
    );
  }

  const output = JSON.stringify({ variants }, null, 2);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ais_fix_artifacts")
    .insert({
      org_id: ORG_ID,
      kind: "meta_rewrite",
      title: `Meta variants for ${p.primary_keyword}`,
      input_json: p as unknown as Record<string, unknown>,
      output_text: output,
      output_format: "text",
      deployment_target: p.cms ?? null,
      source_url: p.page_url,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { data: { artifact: data as FixArtifact, variants } },
    { status: 201 },
  );
}
