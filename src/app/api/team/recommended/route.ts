// GET /api/team/recommended?project_id=<uuid>
// Returns active team members ordered with "recommended" boost first:
//   1. Project lead (top)
//   2. People already assigned to other tasks in this project
//   3. People with the lowest current open-task load (least busy)
// Everyone else is appended A→Z so the caller can render an "All" group below.
//
// Single-tenant; org_id pinned. Lightweight enough to run on every modal open.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  project_id: z.string().uuid().optional(),
});

interface RecommendedMember {
  id: string;
  name: string;
  title: string;
  department: string | null;
  photo_url: string | null;
  open_task_count: number;
  recommendation_reason: string | null; // null = not recommended
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    project_id: url.searchParams.get("project_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const projectId = parsed.data.project_id;
  const supabase = createAdminClient();

  const { data: members, error } = await supabase
    .from("hr_team_members")
    .select("id, name, title, department, photo_url")
    .eq("org_id", ORG_ID)
    .eq("status", "active")
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!members || members.length === 0) {
    return NextResponse.json({ data: { recommended: [], all: [] } });
  }

  // Open-task load per member (status != done across all projects).
  const memberIds = members.map((m) => m.id);
  const { data: loadRows } = await supabase
    .from("pm_tasks")
    .select("assignee_team_member_id")
    .in("assignee_team_member_id", memberIds)
    .neq("status", "done");
  const loadByMember = new Map<string, number>();
  for (const row of (loadRows ?? []) as Array<{
    assignee_team_member_id: string | null;
  }>) {
    if (!row.assignee_team_member_id) continue;
    loadByMember.set(
      row.assignee_team_member_id,
      (loadByMember.get(row.assignee_team_member_id) ?? 0) + 1,
    );
  }

  // Project-context boost: people on this project already + project lead.
  const projectPeers = new Set<string>();
  let projectLeadId: string | null = null;
  if (projectId) {
    const { data: proj } = await supabase
      .from("pm_projects")
      .select("lead_team_member_id")
      .eq("id", projectId)
      .maybeSingle();
    projectLeadId = (proj?.lead_team_member_id as string | null) ?? null;

    const { data: peers } = await supabase
      .from("pm_tasks")
      .select("assignee_team_member_id")
      .eq("project_id", projectId)
      .not("assignee_team_member_id", "is", null);
    for (const p of (peers ?? []) as Array<{
      assignee_team_member_id: string | null;
    }>) {
      if (p.assignee_team_member_id) projectPeers.add(p.assignee_team_member_id);
    }
  }

  const enriched: RecommendedMember[] = members.map((m) => {
    const load = loadByMember.get(m.id) ?? 0;
    let reason: string | null = null;
    if (projectLeadId && m.id === projectLeadId) reason = "Project lead";
    else if (projectPeers.has(m.id)) reason = "Already on this project";
    return {
      id: m.id,
      name: m.name,
      title: m.title,
      department: m.department,
      photo_url: m.photo_url,
      open_task_count: load,
      recommendation_reason: reason,
    };
  });

  // Recommendation set = project lead + project peers + 3 least-busy active members.
  const seenIds = new Set<string>();
  const recommended: RecommendedMember[] = [];
  const pushOnce = (m: RecommendedMember) => {
    if (seenIds.has(m.id)) return;
    seenIds.add(m.id);
    recommended.push(m);
  };

  for (const m of enriched) {
    if (m.recommendation_reason) pushOnce(m);
  }
  const leastBusy = [...enriched]
    .filter((m) => !seenIds.has(m.id))
    .sort((a, b) => a.open_task_count - b.open_task_count)
    .slice(0, 3)
    .map((m) => ({ ...m, recommendation_reason: m.recommendation_reason ?? "Lightest workload" }));
  for (const m of leastBusy) pushOnce(m);

  return NextResponse.json({ data: { recommended, all: enriched } });
}
