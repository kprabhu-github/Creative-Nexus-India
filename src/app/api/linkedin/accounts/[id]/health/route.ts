// ---------------------------------------------------------------------------
// GET /api/linkedin/accounts/[id]/health — read the materialized view row
// PATCH /api/linkedin/accounts/[id]/health — operator killswitch controls
//   body { stop_flag?: boolean, stop_flag_reason?: string,
//          cooldown_minutes?: number, cooldown_reason?: string,
//          clear_cooldown?: true }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  // Special-case: id === 'all' returns every account's health in one call.
  if (params.id === "all") {
    const { data, error } = await supabase
      .from("linkedin_accounts_health")
      .select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] });
  }

  const { data, error } = await supabase
    .from("linkedin_accounts_health")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    stop_flag?: boolean;
    stop_flag_reason?: string;
    cooldown_minutes?: number;
    cooldown_reason?: string;
    clear_cooldown?: boolean;
  };

  const updates: Record<string, unknown> = {};
  const messages: string[] = [];

  if (body.stop_flag !== undefined) {
    updates.stop_flag = body.stop_flag;
    updates.stop_flag_reason = body.stop_flag ? body.stop_flag_reason ?? "Paused by operator" : null;
    messages.push(body.stop_flag ? "Outreach PAUSED" : "Outreach RESUMED");
  }

  if (body.cooldown_minutes !== undefined && body.cooldown_minutes > 0) {
    const until = new Date(
      Date.now() + Math.min(body.cooldown_minutes, 60 * 24 * 7) * 60_000,
    ).toISOString();
    updates.cooldown_until = until;
    updates.cooldown_reason = body.cooldown_reason ?? "Manual cooldown";
    messages.push(`Cooldown set for ${body.cooldown_minutes} minutes`);
  }

  if (body.clear_cooldown) {
    updates.cooldown_until = null;
    updates.cooldown_reason = null;
    messages.push("Cooldown cleared");
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields in request" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("linkedin_accounts")
    .update(updates)
    .eq("id", params.id)
    .select("id, name")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Update failed: ${error?.message ?? "not found"}` },
      { status: 404 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    account_id: data.id,
    message: `${messages.join("; ")} for ${data.name}`,
    type: body.stop_flag ? "warn" : "info",
  });

  return NextResponse.json({ ok: true });
}
