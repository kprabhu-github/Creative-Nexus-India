// ---------------------------------------------------------------------------
// /api/ai-lab/agents — Agent template CRUD
// ---------------------------------------------------------------------------
// GET:  Returns all active agent templates ordered by usage_count desc
// POST: Creates a new custom agent template
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// GET — List active agent templates
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ais_agent_templates")
      .select(
        "id, code, name, description, category, icon, system_prompt, model_tier, usage_count, last_used_at, is_active, created_at",
      )
      .eq("is_active", true)
      .order("usage_count", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch agent templates: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/ai-lab/agents error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new custom agent template
// ---------------------------------------------------------------------------

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.enum(["marketing", "research", "content", "operations", "data", "assistant"]),
  icon: z.string().max(100).optional().default("Bot"),
  systemPrompt: z.string().min(10).max(50000),
  modelTier: z.enum(["strategy", "execution", "research"]).optional().default("execution"),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = CreateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { name, description, category, icon, systemPrompt, modelTier } =
      parsed.data;

    const supabase = createAdminClient();

    // Generate a unique code for the custom agent
    const code = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from("ais_agent_templates")
      .insert({
        code,
        name,
        description,
        category,
        icon,
        system_prompt: systemPrompt,
        model_tier: modelTier,
        is_active: true,
        usage_count: 0,
      })
      .select("id, code, name, description, category, icon, model_tier, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to create template: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/ai-lab/agents error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
