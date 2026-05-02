// ---------------------------------------------------------------------------
// GET    /api/people/[slug] — fetch one team member.
// PATCH  /api/people/[slug] — update mutable fields (Zod validated).
// Auth gate handled at middleware level.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamMember } from "@/lib/people/types";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

const SlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "slug must be lowercase kebab-case");

const PatchSchema = z
  .object({
    bio: z.string().trim().max(2000).nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    department: z.string().trim().min(1).max(100).nullable().optional(),
    photo_url: z.string().url().max(1000).nullable().optional(),
    email: z.string().email().max(320).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    linkedin_url: z.string().url().max(500).nullable().optional(),
    twitter_url: z.string().url().max(500).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    status: z.enum(["active", "inactive", "alumni"]).optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  ctx: { params: { slug: string } },
) {
  const slugParse = SlugSchema.safeParse(ctx.params.slug);
  if (!slugParse.success) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_team_members")
    .select("*")
    .eq("org_id", ORG_ID)
    .eq("slug", slugParse.data)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Member not found", data: { member: null } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: { member: data as TeamMember } });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { slug: string } },
) {
  const slugParse = SlugSchema.safeParse(ctx.params.slug);
  if (!slugParse.success) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid fields", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hr_team_members")
    .update(parsed.data)
    .eq("org_id", ORG_ID)
    .eq("slug", slugParse.data)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { member: data as TeamMember } });
}
