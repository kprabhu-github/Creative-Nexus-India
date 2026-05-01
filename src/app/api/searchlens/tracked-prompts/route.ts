// ---------------------------------------------------------------------------
// /api/searchlens/tracked-prompts — CRUD for daily-rescanned prompts
// ---------------------------------------------------------------------------
// GET    list all tracked prompts for ORG_ID (newest first)
// POST   create a new tracked prompt (max 50 per org)
// PATCH  update mutable fields (paused, frequency_days, drop_alert_threshold)
// DELETE remove a tracked prompt by id
//
// All endpoints scope by ORG_ID and return { data } / { error }.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const MAX_TRACKED_PER_ORG = 50;

const CreateSchema = z.object({
  prompt: z.string().min(1).max(1000),
  brand_name: z.string().min(1).max(200),
  frequency_days: z.number().int().min(1).max(30).optional(),
  drop_alert_threshold: z.number().int().min(1).max(100).optional(),
});

const PatchSchema = z.object({
  id: z.string().uuid(),
  paused: z.boolean().optional(),
  frequency_days: z.number().int().min(1).max(30).optional(),
  drop_alert_threshold: z.number().int().min(1).max(100).optional(),
});

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET — list all tracked prompts for ORG_ID
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ais_tracked_prompts")
      .select("*")
      .eq("org_id", ORG_ID)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a tracked prompt (enforces 50-per-org cap)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Enforce 50-row cap per org
    const { count, error: countError } = await supabase
      .from("ais_tracked_prompts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ORG_ID);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_TRACKED_PER_ORG) {
      return NextResponse.json(
        { error: `Tracked prompt cap reached (${MAX_TRACKED_PER_ORG}). Pause or remove an existing one first.` },
        { status: 400 },
      );
    }

    const insertRow = {
      org_id: ORG_ID,
      brand_name: parsed.data.brand_name,
      prompt: parsed.data.prompt,
      frequency_days: parsed.data.frequency_days ?? 1,
      drop_alert_threshold: parsed.data.drop_alert_threshold ?? 15,
    };

    const { data, error } = await supabase
      .from("ais_tracked_prompts")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      // Unique violation → 409
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This prompt is already tracked for that brand." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update mutable fields
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { id, paused, frequency_days, drop_alert_threshold } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (typeof paused === "boolean") updates.paused = paused;
    if (typeof frequency_days === "number") updates.frequency_days = frequency_days;
    if (typeof drop_alert_threshold === "number")
      updates.drop_alert_threshold = drop_alert_threshold;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No mutable fields supplied" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ais_tracked_prompts")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ORG_ID)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Tracked prompt not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a tracked prompt
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ais_tracked_prompts")
      .delete()
      .eq("id", parsed.data.id)
      .eq("org_id", ORG_ID);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: { id: parsed.data.id, deleted: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
