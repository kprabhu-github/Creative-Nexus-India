// POST /api/searchlens/fix/llms-txt
// Generates a deployment-ready llms.txt for the given domain. Pulls page
// list + descriptions from the LLM using the title/summary user supplied.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/anthropic";
import type { FixArtifact } from "@/lib/searchlens/fix-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const Schema = z.object({
  domain: z.string().min(1).max(200),
  brand_name: z.string().trim().min(1).max(120),
  one_line_pitch: z.string().trim().min(1).max(400),
  key_pages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(400).optional(),
      }),
    )
    .max(40),
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

  const pagesBlock = p.key_pages
    .map(
      (k) =>
        `- [${k.title}](${k.url})${k.summary ? `: ${k.summary}` : ""}`,
    )
    .join("\n");

  const systemPrompt = `You are an SEO + GEO (Generative Engine Optimization) expert. You write llms.txt files that help AI search engines (ChatGPT, Claude, Perplexity, Gemini) understand and accurately cite a website. Output ONLY the llms.txt file content. No markdown fences, no preamble, no closing notes — just the file body.`;

  const userMessage = `Generate llms.txt for:

Brand: ${p.brand_name}
Domain: ${p.domain}
Pitch: ${p.one_line_pitch}

Key pages:
${pagesBlock}

Follow the llms.txt spec exactly:
- Start with "# ${p.brand_name}" as H1
- Add the pitch as a blockquote (> ...) under H1
- Add an "## Overview" section with 1–2 short paragraphs
- Then a "## Pages" section listing every page as a markdown link with its summary
- Optionally an "## Optional" section for secondary content
- No trailing chatter.`;

  const response = await callClaude({
    tier: "execution",
    systemPrompt,
    userMessage,
    maxTokens: 2000,
    temperature: 0.3,
  });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ais_fix_artifacts")
    .insert({
      org_id: ORG_ID,
      kind: "llms_txt",
      title: `llms.txt for ${p.domain}`,
      input_json: p as unknown as Record<string, unknown>,
      output_text: response.text,
      output_format: "markdown",
      deployment_target: p.cms ?? null,
      source_url: p.domain,
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
