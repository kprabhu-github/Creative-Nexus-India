// ---------------------------------------------------------------------------
// PATCH /api/notifications/[id] — Update notification state
// ---------------------------------------------------------------------------
// Mark as read, dismissed, or actioned.
// Body: { is_read?, is_dismissed?, is_actioned? }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const PatchSchema = z.object({
  is_read: z.boolean().optional(),
  is_dismissed: z.boolean().optional(),
  is_actioned: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("core_action_notifications")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(`PATCH /api/notifications/${id} error:`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("PATCH /api/notifications/[id] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
