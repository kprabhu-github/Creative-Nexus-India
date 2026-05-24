// GET /api/attendance/today
// Returns today's attendance log per team member (joined with member info).
// Used for the "Team Today" admin/board view.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AttendanceLog } from "@/lib/hr/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  name: string;
  title: string;
  department: string | null;
  photo_url: string | null;
  log: AttendanceLog | null;
}

export async function GET() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: members, error: mErr } = await admin
    .from("hr_team_members")
    .select("id, name, title, department, photo_url")
    .eq("org_id", ORG_ID)
    .eq("status", "active")
    .order("name");
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const ids = (members ?? []).map((m) => m.id);
  const logsByMember = new Map<string, AttendanceLog>();
  if (ids.length > 0) {
    const { data: logs } = await admin
      .from("hr_attendance_logs")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("log_date", today)
      .in("team_member_id", ids);
    for (const l of (logs ?? []) as AttendanceLog[]) {
      logsByMember.set(l.team_member_id, l);
    }
  }

  const rows: Row[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    title: m.title,
    department: m.department,
    photo_url: m.photo_url,
    log: logsByMember.get(m.id) ?? null,
  }));

  return NextResponse.json({ data: { rows, date: today } });
}
