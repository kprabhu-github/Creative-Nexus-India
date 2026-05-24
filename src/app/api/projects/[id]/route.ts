// PATCH  /api/projects/[id] — update project fields
// DELETE /api/projects/[id] — hard-delete (tasks cascade if FK set; otherwise manual cleanup)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PmProject } from "@/lib/pm/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z
      .enum(["active", "on_hold", "completed", "archived"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    deadline: z.string().date().nullable().optional(),
    client_id: z.string().uuid().nullable().optional(),
    lead_team_member_id: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).optional(),
    quality_score: z.number().nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pm_projects")
    .update(parsed.data)
    .eq("org_id", ORG_ID)
    .eq("id", idParse.data)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { project: data as PmProject } });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const idParse = IdSchema.safeParse(ctx.params.id);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = createAdminClient();
  // Wipe tasks first, then project.
  await supabase.from("pm_tasks").delete().eq("project_id", idParse.data);
  const { error } = await supabase
    .from("pm_projects")
    .delete()
    .eq("org_id", ORG_ID)
    .eq("id", idParse.data);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}
