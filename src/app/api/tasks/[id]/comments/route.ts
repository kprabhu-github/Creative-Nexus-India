// GET  /api/tasks/[id]/comments — list (newest last)
// POST /api/tasks/[id]/comments — add

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PmTaskComment } from "@/lib/pm/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

const CreateSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  author_team_member_id: z.string().uuid().nullable().optional(),
  author_name: z.string().trim().max(120).nullable().optional(),
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
    .from("pm_task_comments")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("task_id", idParse.data)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    data: { comments: (data ?? []) as PmTaskComment[] },
  });
}

export async function POST(
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
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pm_task_comments")
    .insert({
      task_id: idParse.data,
      org_id: ORG_ID,
      body: parsed.data.body,
      author_team_member_id: parsed.data.author_team_member_id ?? null,
      author_name: parsed.data.author_name ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { data: { comment: data as PmTaskComment } },
    { status: 201 },
  );
}
