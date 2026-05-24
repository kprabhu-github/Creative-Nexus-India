// ---------------------------------------------------------------------------
// GET  /api/team — list team members for the agency directory.
//   Query params: department, status (default 'active'), search (name/title ILIKE)
// POST /api/team — create a new team member (used by inline "add teammate"
//   flows in pickers/comboboxes; slug auto-generated from name).
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

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200).default("Team member"),
  department: z.string().trim().min(1).max(100).nullable().optional(),
  role_tag: z
    .enum(["founder", "mentor", "team", "extended", "intern", "alumni"])
    .default("team"),
  email: z.string().email().max(320).nullable().optional(),
  photo_url: z.string().url().max(1000).nullable().optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "member";
}

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
  const base = slugify(parsed.data.name);

  // Ensure slug uniqueness within the org by suffixing -2, -3, …
  // Worst case takes a handful of round-trips; fine for an admin add flow.
  let slug = base;
  for (let n = 2; n <= 99; n++) {
    const { count } = await supabase
      .from("hr_team_members")
      .select("id", { head: true, count: "exact" })
      .eq("org_id", ORG_ID)
      .eq("slug", slug);
    if (!count) break;
    slug = `${base}-${n}`;
  }

  const insert = {
    org_id: ORG_ID,
    slug,
    name: parsed.data.name,
    title: parsed.data.title,
    department: parsed.data.department ?? null,
    role_tag: parsed.data.role_tag,
    email: parsed.data.email ?? null,
    photo_url: parsed.data.photo_url ?? null,
    status: "active" as const,
  };

  const { data, error } = await supabase
    .from("hr_team_members")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { data: { member: data as TeamMember } },
    { status: 201 },
  );
}
