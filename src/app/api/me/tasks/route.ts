// GET /api/me/tasks
// Returns tasks assigned to the currently authenticated user.
// Resolves the auth user → hr_team_members.core_user_id → pm_tasks.assignee_team_member_id.
// If the user has no team_member record yet, returns an empty list.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PmTask } from "@/lib/pm/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

export const dynamic = "force-dynamic";

interface MyTasksResponse {
  team_member: {
    id: string;
    name: string;
    title: string;
    photo_url: string | null;
  } | null;
  tasks: Array<
    PmTask & { project_name: string }
  >;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Look up the team_member row linked to this auth user.
  const { data: tm } = await admin
    .from("hr_team_members")
    .select("id, name, title, photo_url")
    .eq("org_id", ORG_ID)
    .eq("core_user_id", user.id)
    .maybeSingle();

  if (!tm) {
    return NextResponse.json({
      data: { team_member: null, tasks: [] } satisfies MyTasksResponse,
    });
  }

  const { data: rows, error } = await admin
    .from("pm_tasks")
    .select("*, pm_projects!inner(name)")
    .eq("org_id", ORG_ID)
    .eq("assignee_team_member_id", tm.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = ((rows ?? []) as Array<PmTask & { pm_projects?: { name: string } }>).map(
    (r) => ({
      ...r,
      project_name: r.pm_projects?.name ?? "Unknown project",
    }),
  );

  return NextResponse.json({
    data: {
      team_member: tm,
      tasks,
    } satisfies MyTasksResponse,
  });
}
