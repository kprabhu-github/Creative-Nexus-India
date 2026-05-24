// GET  /api/projects        — list projects with task counts (active by default)
// POST /api/projects        — create a project

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PmProject, PmTask, PmProjectWithStats } from "@/lib/pm/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  status: z
    .enum(["active", "on_hold", "completed", "archived", "all"])
    .default("active"),
});

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z
    .enum(["active", "on_hold", "completed", "archived"])
    .default("active"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  deadline: z.string().date().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  lead_team_member_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { status } = parsed.data;
  const supabase = createAdminClient();

  let projQ = supabase
    .from("pm_projects")
    .select("*")
    .eq("org_id", ORG_ID)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (status !== "all") projQ = projQ.eq("status", status);

  const { data: projects, error: projErr } = await projQ;
  if (projErr) {
    return NextResponse.json({ error: projErr.message }, { status: 500 });
  }

  const ids = (projects ?? []).map((p) => p.id);
  const countsByProject: Record<string, { task_count: number; done_count: number }> = {};

  if (ids.length > 0) {
    const { data: taskRows, error: taskErr } = await supabase
      .from("pm_tasks")
      .select("project_id, status")
      .in("project_id", ids);
    if (taskErr) {
      return NextResponse.json({ error: taskErr.message }, { status: 500 });
    }
    for (const t of (taskRows ?? []) as Pick<PmTask, "project_id" | "status">[]) {
      const slot =
        countsByProject[t.project_id] ?? { task_count: 0, done_count: 0 };
      slot.task_count += 1;
      if (t.status === "done") slot.done_count += 1;
      countsByProject[t.project_id] = slot;
    }
  }

  const withStats: PmProjectWithStats[] = ((projects ?? []) as PmProject[]).map(
    (p) => ({
      ...p,
      task_count: countsByProject[p.id]?.task_count ?? 0,
      done_count: countsByProject[p.id]?.done_count ?? 0,
    }),
  );

  return NextResponse.json({ data: { projects: withStats } });
}

export async function POST(req: NextRequest) {
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
    .from("pm_projects")
    .insert({ ...parsed.data, org_id: ORG_ID })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: { project: data as PmProject } }, { status: 201 });
}
