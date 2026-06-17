// POST /api/searchlens/fix/schema
// Generates FAQPage JSON-LD from a list of {question, answer} pairs.
// Validates required fields client-side; this route renders deterministic
// JSON-LD without an LLM call so it's free + idempotent.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FixArtifact } from "@/lib/searchlens/fix-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const Schema = z.object({
  page_url: z.string().url(),
  page_title: z.string().trim().min(1).max(200),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        answer: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
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

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: p.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  const output = `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>`;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ais_fix_artifacts")
    .insert({
      org_id: ORG_ID,
      kind: "schema_jsonld",
      title: `FAQ schema for ${p.page_title}`,
      input_json: p as unknown as Record<string, unknown>,
      output_text: output,
      output_format: "jsonld",
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
