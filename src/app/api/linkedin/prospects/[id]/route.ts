// PATCH /api/linkedin/prospects/[id] — update status/step/last_message etc.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    status?: "pending" | "in_sequence" | "replied" | "meeting" | "opted_out";
    step?: number;
    reply_received?: boolean;
    last_message?: string;
    score?: number;
  };

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.step !== undefined) updates.step = body.step;
  if (body.reply_received !== undefined) updates.reply_received = body.reply_received;
  if (body.last_message !== undefined) {
    updates.last_message = body.last_message;
    updates.last_action = new Date().toISOString();
  }
  if (body.score !== undefined) updates.score = body.score;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("linkedin_prospects")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Update failed: ${error?.message ?? "not found"}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ data });
}
