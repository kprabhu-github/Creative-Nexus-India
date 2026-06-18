// POST /api/searchlens/fix/audit { url }
// Runs deterministic GEO-readiness probes and persists per-signal results.
// No LLM. Sub-2-second turnaround for the Fixer "Audit" panel.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSiteAudit } from "@/lib/searchlens/audit-probe";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Schema = z.object({ url: z.string().trim().min(3).max(300) });

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  let report;
  try {
    report = await runSiteAudit(parsed.data.url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Audit failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const rows = report.results.map((r) => ({
    org_id: ORG_ID,
    site_url: report.origin,
    signal: r.signal,
    status: r.status,
    details_json: r.details,
  }));
  await supabase.from("ais_fix_audit").insert(rows);

  return NextResponse.json({ data: { report } }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("site_url");
  const supabase = createAdminClient();
  let q = supabase
    .from("ais_fix_audit")
    .select("*")
    .eq("org_id", ORG_ID)
    .order("checked_at", { ascending: false })
    .limit(100);
  if (url) q = q.eq("site_url", url);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { audits: data ?? [] } }, { status: 200 });
}
