// PATCH  /api/tasks/[id] — update a task
// DELETE /api/tasks/[id] — remove a task

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PmTask } from "@/lib/pm/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z
      .enum(["todo", "in_progress", "review", "done", "blocked"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().date().nullable().optional(),
    assignee_team_member_id: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).optional(),
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
    .from("pm_tasks")
    .update(parsed.data)
    .eq("org_id", ORG_ID)
    .eq("id", idParse.data)
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { task: data as PmTask } });
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
  const { error } = await supabase
    .from("pm_tasks")
    .delete()
    .eq("org_id", ORG_ID)
    .eq("id", idParse.data);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
}
