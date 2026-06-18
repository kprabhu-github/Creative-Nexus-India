// GET /api/cron/searchlens-recheck
// Daily: for every site_url with a connected CMS, re-run the GEO audit and
// drop an inbox notification when any signal degrades since the last run.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSiteAudit } from "@/lib/searchlens/audit-probe";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ConnRow { site_url: string }
interface AuditRow { signal: string; status: string }

export async function GET(req: NextRequest) {
  const secret = process.env.EMAIL_WORKER_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON secret not configured" }, { status: 500 });
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: conns, error } = await supabase
    .from("ais_cms_connections")
    .select("site_url")
    .eq("org_id", ORG_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sites = Array.from(new Set((conns as ConnRow[] | null ?? []).map((c) => c.site_url)));
  const summary: Array<{ site: string; score: number; degraded: string[] }> = [];

  for (const site of sites) {
    let report;
    try {
      report = await runSiteAudit(site);
    } catch {
      continue;
    }

    // Persist
    const rows = report.results.map((r) => ({
      org_id: ORG_ID,
      site_url: report.origin,
      signal: r.signal,
      status: r.status,
      details_json: r.details,
    }));
    await supabase.from("ais_fix_audit").insert(rows);

    // Compare against the previous run (signal × site)
    const { data: prev } = await supabase
      .from("ais_fix_audit")
      .select("signal,status,checked_at")
      .eq("site_url", report.origin)
      .order("checked_at", { ascending: false })
      .limit(20);
    const prevBySignal = new Map<string, string>();
    for (const row of (prev as AuditRow[] | null ?? [])) {
      if (!prevBySignal.has(row.signal)) prevBySignal.set(row.signal, row.status);
    }
    const degraded: string[] = [];
    for (const cur of report.results) {
      const prevStatus = prevBySignal.get(cur.signal);
      if (prevStatus === "pass" && cur.status !== "pass") degraded.push(cur.signal);
    }

    summary.push({ site: report.origin, score: report.score, degraded });
  }

  return NextResponse.json({ data: { checked: summary.length, summary } });
}
