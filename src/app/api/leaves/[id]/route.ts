// PATCH /api/leaves/[id] — approve, reject, or cancel a leave request.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaveRequest } from "@/lib/hr/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

const PatchSchema = z
  .object({
    status: z.enum(["approved", "rejected", "cancelled"]),
    decision_notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idParse = IdSchema.safeParse(ctx.params.id);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hr_leaves")
    .update({
      status: parsed.data.status,
      decision_notes: parsed.data.decision_notes ?? null,
      decided_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("org_id", ORG_ID)
    .eq("id", idParse.data)
    .select("*, hr_team_members(id, name, photo_url, title, department)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { leave: data as LeaveRequest } });
}
