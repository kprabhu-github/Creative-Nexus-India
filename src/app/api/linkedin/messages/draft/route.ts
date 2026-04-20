// POST /api/linkedin/messages/draft
// Generates an AI-personalised LinkedIn message for a prospect + funnel step.

import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FunnelStep {
  actionId: string;
  template?: string;
  aiPersonalise?: boolean;
}

const SYSTEM_PROMPT = `You are Prabhu K, Co-founder of Creative Nexus India — a digital marketing, branding, and design agency in Bengaluru, Gurugram, and Delhi. Known clients include Fortune 100 companies (BCG, KPMG, etc.).

You are writing a short, human LinkedIn outreach message. Write EXACTLY like a busy founder would — warm, direct, specific, zero fluff.

HARD LIMITS:
- For "connect" (connection note): MAX 280 characters total.
- For every other step: MAX 480 characters total.
- No bullet points. No emoji. No hashtags. No markdown.
- British English. Contractions welcome ("we're", "you're", "I'd").

BANNED PHRASES:
"Hope this finds you well", "Thanks for reaching out", "I wanted to reach out",
"We are a full-service", "synergy", "leverage", "cutting-edge", "take to the next level",
"just checking in", "Please don't hesitate".

STRUCTURE:
- Start with "Hi {firstName}," (replace with their actual first name).
- One specific observation about their company or role — prove you read it.
- One concrete connection to what Creative Nexus does (relevant to their role/industry).
- For message/followup steps only: one low-friction ask (10-15 min chat).

Return JSON only: { "message": "<the message text, ready to paste into LinkedIn>" }`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    prospect_id?: string;
    step_index: number;
    save?: boolean;
    action_id?: string;
    template?: string;
  };

  if (body.prospect_id === undefined) {
    return NextResponse.json({ error: "Missing prospect_id" }, { status: 400 });
  }
  if (typeof body.step_index !== "number") {
    return NextResponse.json({ error: "Missing step_index" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: prospect, error: prosErr } = await supabase
    .from("linkedin_prospects")
    .select("id, name, first_name, headline, company, industry, location, campaign_id")
    .eq("id", body.prospect_id)
    .single();

  if (prosErr || !prospect) {
    return NextResponse.json(
      { error: `Prospect not found: ${prosErr?.message ?? "no record"}` },
      { status: 404 },
    );
  }

  // Load funnel step from campaign (unless caller supplies template/action)
  let actionId = body.action_id;
  let template = body.template;
  if (!actionId || template === undefined) {
    const { data: campaign } = await supabase
      .from("linkedin_campaigns")
      .select("funnel_steps")
      .eq("id", prospect.campaign_id)
      .single();
    const steps = (campaign?.funnel_steps as FunnelStep[] | undefined) ?? [];
    const step = steps[body.step_index];
    actionId = actionId ?? step?.actionId ?? "message";
    template = template ?? step?.template ?? "";
  }

  const userMessage = `Prospect:
- Name: ${prospect.name}
- First name: ${prospect.first_name}
- Headline: ${prospect.headline}
- Company: ${prospect.company}
- Industry: ${prospect.industry}
- Location: ${prospect.location}

Step type: ${actionId}
Template to personalise: "${template || "(no template — write from scratch)"}"

Write the LinkedIn message now. Max ${actionId === "connect" ? 280 : 480} characters. Return JSON only.`;

  let messageText = "";
  let aiFailed = false;
  try {
    const { text } = await callClaude({
      tier: "execution",
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 400,
      temperature: 0.5,
    });
    // Try structured JSON parse first (handles fences, escapes, unicode)
    try {
      const parsed = parseClaudeJson(text) as { message?: string };
      if (typeof parsed?.message === "string" && parsed.message.trim().length > 0) {
        messageText = parsed.message.trim();
      } else {
        messageText = text.trim();
      }
    } catch {
      messageText = text.trim();
    }
  } catch (err) {
    aiFailed = true;
    // Fallback: simple template substitution
    messageText = (template || "")
      .replace(/\{firstName\}/g, prospect.first_name || prospect.name.split(" ")[0] || "there")
      .replace(/\{company\}/g, prospect.company || "your company")
      .replace(/\{industry\}/g, prospect.industry || "your industry")
      .replace(/\{headline\}/g, prospect.headline || "")
      .replace(/\{service\}/g, "digital marketing & SEO");
    console.warn("Claude draft fallback:", err);
  }

  if (body.save) {
    await supabase
      .from("linkedin_prospects")
      .update({
        last_message: messageText,
        last_action: new Date().toISOString(),
      })
      .eq("id", prospect.id);
  }

  return NextResponse.json({
    data: {
      message: messageText,
      step_index: body.step_index,
      action_id: actionId,
      ai_failed: aiFailed,
    },
  });
}
