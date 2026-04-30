// ---------------------------------------------------------------------------
// GET + POST /api/notifications — List and create notifications
// ---------------------------------------------------------------------------
// GET:  Returns notifications ordered by priority then created_at.
//       Query params: ?limit=20&unread=true
// POST: Creates a new notification.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// Priority sort order (used in the query via a computed column or post-sort)
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const unreadOnly = searchParams.get("unread") === "true";

    const supabase = createAdminClient();

    let query = supabase
      .from("core_action_notifications")
      .select("*")
      .eq("org_id", ORG_ID)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/notifications error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Post-sort by priority then by created_at descending
    const sorted = (data ?? []).sort((a, b) => {
      const aPriority = PRIORITY_ORDER[a.priority as string] ?? 2;
      const bPriority = PRIORITY_ORDER[b.priority as string] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime()
      );
    });

    return NextResponse.json({ data: sorted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/notifications error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/notifications
// ---------------------------------------------------------------------------

const CreateNotificationSchema = z.object({
  title: z.string().min(1).max(500),
  message: z.string().max(5000).optional(),
  category: z.string().min(1).max(100),
  priority: z
    .enum(["critical", "high", "medium", "low"])
    .optional()
    .default("medium"),
  sourceModule: z.string().max(100).optional(),
  sourceUrl: z.string().max(2000).optional(),
  actions: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().optional(),
        api: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { title, message, category, priority, sourceModule, sourceUrl, actions } =
      parsed.data;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("core_action_notifications")
      .insert({
        org_id: ORG_ID,
        title,
        message: message ?? null,
        category,
        priority,
        source_module: sourceModule ?? null,
        source_url: sourceUrl ?? null,
        actions,
        is_read: false,
        is_dismissed: false,
        is_actioned: false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("POST /api/notifications error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/notifications error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
