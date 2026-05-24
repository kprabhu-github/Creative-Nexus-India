// GET /api/attendance/me?month=YYYY-MM
// Returns the current user's attendance for the requested month (default: current).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AttendanceLog } from "@/lib/hr/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
    .optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);
  const [year, mo] = month.split("-").map(Number);
  if (!year || !mo) {
    return NextResponse.json({ error: "Bad month" }, { status: 400 });
  }
  const start = `${month}-01`;
  // Last day of month inclusive.
  const last = new Date(year, mo, 0).getDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;

  const admin = createAdminClient();
  const { data: tm } = await admin
    .from("hr_team_members")
    .select("id, name")
    .eq("org_id", ORG_ID)
    .eq("core_user_id", user.id)
    .maybeSingle();
  if (!tm) {
    return NextResponse.json({
      data: { team_member: null, logs: [] as AttendanceLog[] },
    });
  }

  const { data, error } = await admin
    .from("hr_attendance_logs")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("team_member_id", tm.id)
    .gte("log_date", start)
    .lte("log_date", end)
    .order("log_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    data: { team_member: tm, logs: (data ?? []) as AttendanceLog[] },
  });
}
