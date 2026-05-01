// ---------------------------------------------------------------------------
// GET + PUT /api/settings — Agency config CRUD
// ---------------------------------------------------------------------------
// GET:  Returns the agency config for the default org.
// PUT:  Accepts a partial update body and merges into existing config.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// PATCH validation schema — narrow, field-specific updates
const PatchSchema = z.object({
  searchlens_prompts: z.array(z.string().min(1).max(500)).max(50).optional(),
}).strict();

// ---------------------------------------------------------------------------
// GET /api/settings
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("core_agency_config")
      .select("*")
      .eq("org_id", ORG_ID)
      .single();

    if (error) {
      // If no row exists yet, return an empty config shell
      if (error.code === "PGRST116") {
        return NextResponse.json({ data: { org_id: ORG_ID } });
      }
      console.error("GET /api/settings error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/settings error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/settings
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Remove fields that should not be updated directly
    delete body.id;
    delete body.org_id;
    delete body.created_at;

    const supabase = createAdminClient();

    // Check if a config row already exists
    const { data: existing, error: fetchError } = await supabase
      .from("core_agency_config")
      .select("id")
      .eq("org_id", ORG_ID)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("PUT /api/settings fetch error:", fetchError.message);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 },
      );
    }

    let result;

    if (existing) {
      // Update existing row
      const { data, error } = await supabase
        .from("core_agency_config")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("org_id", ORG_ID)
        .select("*")
        .single();

      if (error) {
        console.error("PUT /api/settings update error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // Insert new row
      const { data, error } = await supabase
        .from("core_agency_config")
        .insert({ org_id: ORG_ID, ...body })
        .select("*")
        .single();

      if (error) {
        console.error("PUT /api/settings insert error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("PUT /api/settings error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/settings — narrow updates (currently: searchlens_prompts)
export async function PATCH(request: Request) {
  try {
    const parsed = PatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const updates = { ...parsed.data, updated_at: new Date().toISOString() };
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("core_agency_config").select("id").eq("org_id", ORG_ID).maybeSingle();
    const q = existing
      ? supabase.from("core_agency_config").update(updates).eq("org_id", ORG_ID)
      : supabase.from("core_agency_config").insert({ org_id: ORG_ID, ...updates });
    const { data, error } = await q.select("*").single();
    if (error) {
      console.error("PATCH /api/settings error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("PATCH /api/settings error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
