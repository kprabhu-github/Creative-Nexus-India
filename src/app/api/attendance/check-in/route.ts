// POST /api/attendance/check-in
// Idempotent: creates today's hr_attendance_logs row for the current user
// if missing. Captures IP and User-Agent from request headers. Returns the
// current row (existing or freshly created) so the UI can render the pill.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AttendanceLog, AttendanceStatus } from "@/lib/hr/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    geo_lat: z.number().min(-90).max(90).optional(),
    geo_lng: z.number().min(-180).max(180).optional(),
    initial_status: z
      .enum([
        "present",
        "wfh",
        "meeting",
        "away",
        "sick",
        "absent",
        "leave",
      ])
      .optional(),
  })
  .optional();

function extractIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = undefined;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // ignore — empty body is fine
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve team_member from auth user.
  const { data: tm } = await admin
    .from("hr_team_members")
    .select("id")
    .eq("org_id", ORG_ID)
    .eq("core_user_id", user.id)
    .maybeSingle();

  if (!tm) {
    return NextResponse.json(
      { error: "No team member linked to this user yet" },
      { status: 404 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const ip = extractIp(req);
  const ua = req.headers.get("user-agent");
  const initialStatus: AttendanceStatus = parsed.data?.initial_status ?? "present";

  // Existing row?
  const { data: existing } = await admin
    .from("hr_attendance_logs")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("team_member_id", tm.id)
    .eq("log_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      data: { log: existing as AttendanceLog, created: false },
    });
  }

  const { data, error } = await admin
    .from("hr_attendance_logs")
    .insert({
      org_id: ORG_ID,
      team_member_id: tm.id,
      user_id: user.id,
      log_date: today,
      status: initialStatus,
      ip_address: ip,
      user_agent: ua,
      geo_lat: parsed.data?.geo_lat ?? null,
      geo_lng: parsed.data?.geo_lng ?? null,
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
    { data: { log: data as AttendanceLog, created: true } },
    { status: 201 },
  );
}
