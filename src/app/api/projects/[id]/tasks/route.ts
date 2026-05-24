// GET  /api/projects/[id]/tasks — list tasks for a project (ordered by status + position)
// POST /api/projects/[id]/tasks — create a task

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PmTask } from "@/lib/pm/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z
    .enum(["todo", "in_progress", "review", "done", "blocked"])
    .default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  start_date: z.string().date().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  assignee_team_member_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const idParse = IdSchema.safeParse(ctx.params.id);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pm_tasks")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("project_id", idParse.data)
    .order("status", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { tasks: (data ?? []) as PmTask[] } });
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const idParse = IdSchema.safeParse(ctx.params.id);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pm_tasks")
    .insert({
      ...parsed.data,
      project_id: idParse.data,
      org_id: ORG_ID,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: { task: data as PmTask } }, { status: 201 });
}
