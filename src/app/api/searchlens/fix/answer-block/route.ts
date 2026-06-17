// POST /api/searchlens/fix/answer-block
// Generates a 150-word citable answer block for a specific query so AI
// engines (ChatGPT, Perplexity, Gemini, Google AI Overviews) lift the
// passage verbatim into citations. Output is plain HTML ready to paste.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/anthropic";
import type { FixArtifact } from "@/lib/searchlens/fix-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const Schema = z.object({
  query: z.string().trim().min(3).max(400),
  brand_name: z.string().trim().min(1).max(120),
  page_url: z.string().url(),
  facts: z.array(z.string().trim().max(500)).max(15).optional(),
  tone: z.enum(["neutral", "expert", "confident", "warm"]).default("neutral"),
  target_words: z.number().int().min(80).max(300).default(150),
  cms: z.string().trim().max(40).optional(),
});

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

  const factsBlock = (p.facts ?? []).map((f, i) => `${i + 1}. ${f}`).join("\n");

  const systemPrompt = `You are a GEO (Generative Engine Optimization) copywriter. Your output is HTML that AI search engines will quote verbatim when answering user queries. Rules:
- Output ONLY a single <section> HTML block. No markdown, no preamble.
- The block contains: 1 <h2> restating the query as a statement; 2–4 short paragraphs (~${p.target_words} words total); a clear opening sentence that answers the query in 15–25 words; a <ul> with 3–5 supporting bullets if useful; the brand name mentioned at least once naturally.
- Avoid hype, hedging, marketing fluff. Concrete, factual, attributable.
- Tone: ${p.tone}.`;

  const userMessage = `Query users will ask: "${p.query}"
Brand: ${p.brand_name}
Page where this lives: ${p.page_url}

Known facts to ground the answer:
${factsBlock || "(none — use general knowledge but stay specific to the brand)"}

Generate the answer block now.`;

  const response = await callClaude({
    tier: "execution",
    systemPrompt,
    userMessage,
    maxTokens: 1200,
    temperature: 0.4,
  });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ais_fix_artifacts")
    .insert({
      org_id: ORG_ID,
      kind: "answer_block",
      title: `Answer: ${p.query.slice(0, 80)}`,
      input_json: p as unknown as Record<string, unknown>,
      output_text: response.text,
      output_format: "html",
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
    { data: { artifact: data as FixArtifact } },
    { status: 201 },
  );
}
