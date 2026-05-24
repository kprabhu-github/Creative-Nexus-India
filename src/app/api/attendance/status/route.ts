// PATCH /api/attendance/status
// Updates today's status for the current user (Present, WFH, Meeting, etc).
// Creates the row if missing — equivalent to "check in as X".

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AttendanceLog } from "@/lib/hr/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  status: z.enum([
    "present",
    "wfh",
    "meeting",
    "away",
    "sick",
    "absent",
    "leave",
  ]),
  notes: z.string().trim().max(500).optional(),
});

function extractIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: tm } = await admin
    .from("hr_team_members")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("core_user_id", user.id)
    .maybeSingle();
  if (!tm) {
    return NextResponse.json(
      { error: "No team member linked" },
      { status: 404 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const ip = extractIp(req);
  const ua = req.headers.get("user-agent");

  // Upsert: insert today's row or update existing.
  const { data, error } = await admin
    .from("hr_attendance_logs")
    .upsert(
      {
        org_id: ORG_ID,
        team_member_id: tm.id,
        user_id: user.id,
        log_date: today,
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
        ip_address: ip,
        user_agent: ua,
        last_status_change_at: new Date().toISOString(),
      },
      { onConflict: "org_id,team_member_id,log_date" },
    )
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: { log: data as AttendanceLog } });
}
