// ---------------------------------------------------------------------------
// /api/cron/searchlens-track — daily auto-rescan of tracked prompts
// ---------------------------------------------------------------------------
// Iterates due ais_tracked_prompts rows, re-runs single-prompt scoring across
// all 6 AI platforms, appends ais_prompt_scores history, and fires drop
// notifications when visibility falls more than `drop_alert_threshold` percent
// vs the previous run.
//
// Idempotency: rows are filtered by (last_scanned_at IS NULL OR
// last_scanned_at < now() - interval '<frequency_days> days'), so a second
// firing within the same window simply finds nothing to do.
//
// Auth: Authorization: Bearer ${CRON_SECRET} header (matches the
// /api/cron/email-sync pattern). When CRON_SECRET is unset, calls are
// permitted (dev mode).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { scoreSinglePrompt, ALL_PLATFORMS } from "@/lib/searchlens/score-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const BATCH_LIMIT = 50;

interface TrackedPromptRow {
  id: string;
  org_id: string;
  brand_name: string;
  prompt: string;
  frequency_days: number;
  last_scanned_at: string | null;
  last_score: number | null;
  drop_alert_threshold: number;
  paused: boolean;
}

interface ProcessedSummary {
  id: string;
  prompt: string;
  brand_name: string;
  previous_score: number | null;
  new_score: number;
  drop_pct: number | null;
  alerted: boolean;
}

interface ErrorSummary {
  id: string;
  prompt: string;
  message: string;
}

function authorised(request: NextRequest): boolean {
  const token = process.env.CRON_SECRET;
  if (!token) return true; // dev only
  const header = request.headers.get("authorization") ?? "";
  return (
    header === `Bearer ${token}` ||
    request.nextUrl.searchParams.get("secret") === token
  );
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // -------------------------------------------------------------------------
  // 1) Fetch due tracked prompts
  // -------------------------------------------------------------------------
  // Pull a generous window (paused = false), then filter due rows in JS so we
  // can compare per-row against `frequency_days`. Keep BATCH_LIMIT small to
  // bound cron cost.

  const { data: rows, error: fetchError } = await supabase
    .from("ais_tracked_prompts")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("paused", false)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT * 2);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const candidates = ((rows ?? []) as TrackedPromptRow[]).filter((r) => {
    if (!r.last_scanned_at) return true;
    const last = new Date(r.last_scanned_at).getTime();
    const dueAt = last + r.frequency_days * 24 * 60 * 60 * 1000;
    return Date.now() >= dueAt;
  });

  const due = candidates.slice(0, BATCH_LIMIT);

  const processed: ProcessedSummary[] = [];
  const errors: ErrorSummary[] = [];
  let alerted = 0;

  // -------------------------------------------------------------------------
  // 2) Process each due row sequentially (Claude + ragBrowse rate limits)
  // -------------------------------------------------------------------------

  for (const row of due) {
    try {
      const result = await scoreSinglePrompt({
        prompt: row.prompt,
        brandName: row.brand_name,
        platforms: [...ALL_PLATFORMS],
        orgId: ORG_ID,
        persistCitations: true,
      });

      const newScore = result.score;
      const previousScore = row.last_score;

      // ---------------------------------------------------------------------
      // 3) Append history row to ais_prompt_scores
      // ---------------------------------------------------------------------
      const { error: scoreInsertError } = await supabase
        .from("ais_prompt_scores")
        .insert({
          org_id: ORG_ID,
          scan_id: null,
          brand_name: row.brand_name,
          prompt: row.prompt,
          score: newScore,
          confidence: result.averageConfidence,
          platforms_checked: result.platformsChecked,
          scanned_at: new Date().toISOString(),
        });

      if (scoreInsertError) {
        console.error(
          `[searchlens-track] failed to insert ais_prompt_scores for ${row.id}:`,
          scoreInsertError.message,
        );
      }

      // ---------------------------------------------------------------------
      // 4) Drop alert: compute % change vs last_score
      // ---------------------------------------------------------------------
      let dropPct: number | null = null;
      let didAlert = false;

      if (typeof previousScore === "number" && previousScore > 0) {
        // Negative delta = drop. Express drop as positive percent.
        const deltaPct = ((newScore - previousScore) / previousScore) * 100;
        if (deltaPct < 0) {
          dropPct = Math.round(Math.abs(deltaPct));
          if (dropPct > row.drop_alert_threshold) {
            await createNotification({
              title: `Visibility drop on tracked prompt`,
              message: `"${row.prompt}" dropped from ${previousScore} to ${newScore} (-${dropPct}%) on ${row.brand_name}.`,
              category: "searchlens",
              priority: dropPct >= 30 ? "critical" : "high",
              sourceModule: "searchlens",
              sourceUrl: "/searchlens?tab=Tracked",
              actions: [
                { label: "View Tracked Prompts", url: "/searchlens?tab=Tracked" },
              ],
            });
            didAlert = true;
            alerted += 1;
          }
        }
      }

      // ---------------------------------------------------------------------
      // 5) Update tracked-prompt row with new last_scanned_at + last_score
      // ---------------------------------------------------------------------
      const { error: updateError } = await supabase
        .from("ais_tracked_prompts")
        .update({
          last_scanned_at: new Date().toISOString(),
          last_score: newScore,
        })
        .eq("id", row.id)
        .eq("org_id", ORG_ID);

      if (updateError) {
        console.error(
          `[searchlens-track] failed to update tracked row ${row.id}:`,
          updateError.message,
        );
      }

      processed.push({
        id: row.id,
        prompt: row.prompt,
        brand_name: row.brand_name,
        previous_score: previousScore,
        new_score: newScore,
        drop_pct: dropPct,
        alerted: didAlert,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[searchlens-track] row ${row.id} failed:`, msg);
      errors.push({ id: row.id, prompt: row.prompt, message: msg });
    }
  }

  return NextResponse.json({
    data: {
      ran_at: nowIso,
      candidates_due: due.length,
      processed: processed.length,
      alerted,
      errors,
      results: processed,
    },
  });
}
