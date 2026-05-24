// GET  /api/leaves?scope=me|pending|all
//   me      — leaves filed by the current user
//   pending — admin queue
//   all     — admin: every leave
// POST /api/leaves — apply for leave (current user → team_member_id)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaveRequest } from "@/lib/hr/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  scope: z.enum(["me", "pending", "all"]).default("me"),
});

const CreateSchema = z
  .object({
    leave_type: z.enum([
      "casual",
      "sick",
      "earned",
      "emergency",
      "unpaid",
      "wfh",
      "other",
    ]),
    start_date: z.string().date(),
    end_date: z.string().date(),
    half_day: z.boolean().default(false),
    half_day_session: z.enum(["AM", "PM"]).nullable().optional(),
    urgency: z.enum(["normal", "urgent", "emergency"]).default("normal"),
    reason: z.string().trim().max(1000).nullable().optional(),
    attachment_url: z.string().url().nullable().optional(),
  })
  .refine((v) => v.start_date <= v.end_date, {
    message: "start_date must be on or before end_date",
  });

function daysBetween(start: string, end: string, halfDay: boolean): number {
  if (halfDay) return 0.5;
  const s = new Date(start);
  const e = new Date(end);
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

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
    scope: url.searchParams.get("scope") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const admin = createAdminClient();
  let q = admin
    .from("hr_leaves")
    .select("*, hr_team_members(id, name, photo_url, title, department)")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });

  if (parsed.data.scope === "me") {
    const { data: tm } = await admin
      .from("hr_team_members")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("core_user_id", user.id)
      .maybeSingle();
    if (!tm) {
      return NextResponse.json({ data: { leaves: [] } });
    }
    q = q.eq("team_member_id", tm.id);
  } else if (parsed.data.scope === "pending") {
    q = q.eq("status", "pending");
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { leaves: data ?? [] } });
}

export async function POST(req: NextRequest) {
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
  const parsed = CreateSchema.safeParse(body);
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
      { error: "No team member linked to your account" },
      { status: 404 },
    );
  }

  const days = daysBetween(
    parsed.data.start_date,
    parsed.data.end_date,
    parsed.data.half_day,
  );

  const { data, error } = await admin
    .from("hr_leaves")
    .insert({
      org_id: ORG_ID,
      team_member_id: tm.id,
      leave_type: parsed.data.leave_type,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      days,
      half_day: parsed.data.half_day,
      half_day_session: parsed.data.half_day_session ?? null,
      urgency: parsed.data.urgency,
      reason: parsed.data.reason ?? null,
      attachment_url: parsed.data.attachment_url ?? null,
      status: "pending",
    })
    .select("*, hr_team_members(id, name, photo_url, title, department)")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { data: { leave: data as LeaveRequest } },
    { status: 201 },
  );
}
