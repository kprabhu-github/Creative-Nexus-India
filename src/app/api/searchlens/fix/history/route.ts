// GET /api/searchlens/fix/history?kind=...
// Lists fix artifacts (newest first) for the History tab. Filters by kind
// when provided so each Fixer sub-panel can show only its own past outputs.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FixArtifact } from "@/lib/searchlens/fix-types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const Schema = z.object({
  kind: z
    .enum([
      "llms_txt",
      "robots_txt",
      "schema_jsonld",
      "answer_block",
      "meta_rewrite",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Schema.safeParse({
    kind: url.searchParams.get("kind") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { kind, limit } = parsed.data;

  const supabase = createAdminClient();
  let q = supabase
    .from("ais_fix_artifacts")
    .select("*")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (kind) q = q.eq("kind", kind);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    data: { artifacts: (data ?? []) as FixArtifact[] },
  });
}
