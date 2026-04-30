// GET   /api/me — current authenticated user's profile (auth + core_users)
// PATCH /api/me — update editable profile fields

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "display_name",
  "avatar_url",
  "phone",
  "title",
  "department",
  "bio",
  "location",
  "timezone",
  "slack_handle",
  "linkedin_url",
] as const;

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("core_users")
    .select("id, org_id, role, display_name, email, avatar_url, phone, title, department, bio, location, timezone, slack_handle, linkedin_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      provider: user.app_metadata?.provider ?? "email",
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profile ?? null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) {
      const v = body[key];
      updates[key] = typeof v === "string" ? v.trim() : v;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("core_users")
    .upsert(
      { id: user.id, email: user.email, ...updates },
      { onConflict: "id" },
    )
    .select("id, display_name, avatar_url, phone, title, department, bio, location, timezone, slack_handle, linkedin_url")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
