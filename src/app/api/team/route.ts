// ---------------------------------------------------------------------------
// GET /api/team — list team members for the agency directory.
// Query params: department, status (default 'active'), search (name/title ILIKE)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TeamCounts,
  TeamListResponse,
  TeamMember,
} from "@/lib/team/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

const QuerySchema = z.object({
  department: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["active", "inactive", "alumni"]).default("active"),
  search: z.string().trim().min(1).max(120).optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    department: url.searchParams.get("department") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { department, status, search } = parsed.data;
  const supabase = createAdminClient();

  let query = supabase
    .from("hr_team_members")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("status", status)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (department) query = query.eq("department", department);
  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(
      `name.ilike.%${escaped}%,title.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = (data ?? []) as TeamMember[];

  const byDept: Record<string, number> = {};
  const departments = new Set<string>();
  for (const m of members) {
    if (m.department) {
      departments.add(m.department);
      byDept[m.department] = (byDept[m.department] ?? 0) + 1;
    }
  }

  const counts: TeamCounts = { total: members.length, byDept };
  const payload: TeamListResponse = {
    members,
    departments: Array.from(departments).sort((a, b) => a.localeCompare(b)),
    counts,
  };

  return NextResponse.json({ data: payload });
}
