// ---------------------------------------------------------------------------
// PATCH  /api/linkedin/accounts/[id] — update limits, working hours, status
// DELETE /api/linkedin/accounts/[id] — remove
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_ID } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    daily_limits?: Record<string, number>;
    working_hours?: { from: string; to: string; days: string[] };
    status?: "ready" | "active" | "paused";
    role?: string;
  };

  const updates: Record<string, unknown> = {};
  if (body.daily_limits !== undefined) updates.daily_limits = body.daily_limits;
  if (body.working_hours !== undefined) updates.working_hours = body.working_hours;
  if (body.status !== undefined) updates.status = body.status;
  if (body.role !== undefined) updates.role = body.role;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: updated, error } = await supabase
    .from("linkedin_accounts")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: `Update failed: ${error?.message ?? "not found"}` },
      { status: 404 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    account_id: params.id,
    message: `Updated ${Object.keys(updates).join(", ")} for ${updated.name}`,
    type: "success",
    org_id: ORG_ID,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();

  const { data: acc } = await supabase
    .from("linkedin_accounts")
    .select("name")
    .eq("id", params.id)
    .maybeSingle();

  const { error } = await supabase
    .from("linkedin_accounts")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error.message}` },
      { status: 500 },
    );
  }

  await supabase.from("linkedin_activity_log").insert({
    message: `Removed account: ${acc?.name ?? params.id}`,
    type: "warn",
    org_id: ORG_ID,
  });

  return NextResponse.json({ data: { deleted: true } });
}
