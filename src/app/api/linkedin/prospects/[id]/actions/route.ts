// ---------------------------------------------------------------------------
// POST /api/linkedin/prospects/[id]/actions
// "I did X on LinkedIn.com" — logs an operator action. HITL, not automation.
// Writes to linkedin_prospect_actions, bumps linkedin_usage, updates the
// prospect's step/status/last_action, and appends to linkedin_activity_log.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeAutoCooldown } from "@/lib/linkedin-compliance";
import { safeAction } from "@/lib/linkedin-safety-pipeline";

export const dynamic = "force-dynamic";

type Outcome = "done" | "replied" | "accepted" | "rejected" | "skipped" | "bounced";
type Status = "pending" | "in_sequence" | "replied" | "meeting" | "opted_out";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    action_key: string;
    message_sent?: string | null;
    outcome?: Outcome;
    advance_step?: boolean;
    set_status?: Status | null;
    operator_notes?: string | null;
  };

  if (!body.action_key) {
    return NextResponse.json(
      { error: "action_key is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // 1. Load prospect so we know campaign_id, account_id, step, profile_url
  const { data: prospect, error: prospectErr } = await supabase
    .from("linkedin_prospects")
    .select(
      "id, step, profile_url, campaign_id, linkedin_campaigns:campaign_id(id, account_id, name)",
    )
    .eq("id", params.id)
    .single();

  if (prospectErr || !prospect) {
    return NextResponse.json(
      { error: `Prospect not found: ${prospectErr?.message ?? "unknown"}` },
      { status: 404 },
    );
  }

  const campaign = Array.isArray(prospect.linkedin_campaigns)
    ? prospect.linkedin_campaigns[0]
    : prospect.linkedin_campaigns;
  const accountId = campaign?.account_id ?? null;
  const outcome: Outcome = body.outcome ?? "done";
  const stepAtAction = prospect.step ?? 0;

  // 1a. Safety pipeline — runs all checkpoints. "skipped" outcome bypasses
  // the pipeline (operator needs a way to mark prospects not-for-me without
  // burning a quota). Returns 429 with the full checkpoint stack on block.
  if (outcome !== "skipped") {
    const pipeline = await safeAction(supabase, {
      accountId,
      actionKey: body.action_key,
      profileUrl: prospect.profile_url,
    });
    if (pipeline.decision === "block") {
      const blocker = pipeline.checkpoints.find(
        (c) => c.id === pipeline.blocked_by,
      );
      return NextResponse.json(
        {
          error:
            blocker?.message ??
            "Safety pipeline blocked this action",
          code: pipeline.blocked_by,
          pipeline,
        },
        { status: pipeline.blocked_by === "url_valid" ? 400 : 429 },
      );
    }
  }

  // 2. Write append-only action record
  const { error: actionErr } = await supabase
    .from("linkedin_prospect_actions")
    .insert({
      prospect_id: prospect.id,
      campaign_id: prospect.campaign_id,
      account_id: accountId,
      action_key: body.action_key,
      message_sent: body.message_sent ?? null,
      outcome,
      step: stepAtAction,
      performed_by: "operator",
    });

  if (actionErr) {
    return NextResponse.json(
      { error: `Action log failed: ${actionErr.message}` },
      { status: 500 },
    );
  }

  // 3. Bump daily usage (one row per account/date/action_key)
  if (accountId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("linkedin_usage")
      .select("id, count")
      .eq("account_id", accountId)
      .eq("date", today)
      .eq("action_key", body.action_key)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("linkedin_usage")
        .update({ count: (existing.count ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("linkedin_usage").insert({
        account_id: accountId,
        date: today,
        action_key: body.action_key,
        count: 1,
      });
    }
  }

  // 4. Update prospect: last_action, last_message, optionally step/status, reply_received
  const prospectUpdates: Record<string, unknown> = {
    last_action: new Date().toISOString(),
  };
  if (body.message_sent !== undefined && body.message_sent !== null) {
    prospectUpdates.last_message = body.message_sent;
  }
  if (body.operator_notes !== undefined && body.operator_notes !== null) {
    prospectUpdates.operator_notes = body.operator_notes;
  }
  if (body.advance_step) {
    prospectUpdates.step = stepAtAction + 1;
  }
  if (body.set_status) {
    prospectUpdates.set_status = undefined; // placeholder to avoid lint warning
    prospectUpdates.status = body.set_status;
  }
  if (outcome === "replied") {
    prospectUpdates.reply_received = true;
    prospectUpdates.status = "replied";
  }
  if (outcome === "accepted" && !body.set_status) {
    prospectUpdates.status = "in_sequence";
  }
  if (outcome === "rejected" || outcome === "bounced") {
    prospectUpdates.status = "opted_out";
    prospectUpdates.completed_at = new Date().toISOString();
  }

  // Clean up sentinel
  delete prospectUpdates.set_status;

  const { error: updateErr } = await supabase
    .from("linkedin_prospects")
    .update(prospectUpdates)
    .eq("id", prospect.id);

  if (updateErr) {
    return NextResponse.json(
      { error: `Prospect update failed: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // 5. Log to activity feed
  await supabase.from("linkedin_activity_log").insert({
    account_id: accountId,
    message: `${body.action_key} → ${outcome} for prospect in campaign "${campaign?.name ?? "n/a"}"`,
    type: outcome === "rejected" || outcome === "bounced" ? "warn" : "success",
  });

  // 6. If the outcome was bad, possibly auto-cooldown the account.
  let cooldownTriggered = false;
  if (outcome === "rejected" || outcome === "bounced") {
    const cd = await maybeAutoCooldown(supabase, accountId);
    cooldownTriggered = cd.triggered;
  }

  return NextResponse.json({ ok: true, cooldown_triggered: cooldownTriggered });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("linkedin_prospect_actions")
    .select("id, action_key, message_sent, outcome, step, performed_by, created_at")
    .eq("prospect_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
