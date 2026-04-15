import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { QUALIFICATION_PROMPT } from "@/lib/leads/prompts";
import { LeadData, LEAD_THRESHOLDS, ORG_ID } from "@/lib/leads/types";

export async function POST(request: NextRequest) {
  const { leads } = (await request.json()) as { leads: LeadData[] };

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get already-scored lead IDs
  const leadIds = leads.map((l) => l.id);
  const { data: existing } = await supabase
    .from("lead_scores")
    .select("lead_id")
    .in("lead_id", leadIds);

  const scoredIds = new Set((existing || []).map((r: { lead_id: string }) => r.lead_id));
  const unscored = leads.filter((l) => !scoredIds.has(l.id));

  if (unscored.length === 0) {
    return NextResponse.json({
      data: { qualified: 0, review: 0, spam: 0, newScores: 0, alreadyScored: leads.length },
    });
  }

  let qualified = 0;
  let review = 0;
  let spam = 0;
  const scores: Array<{ lead_id: string; score: number; reasoning: string }> = [];

  // Score each lead (limit to 50)
  for (const lead of unscored.slice(0, 50)) {
    try {
      const userMessage = `Lead submission:
Name: ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone}
Company: ${lead.company}
Message: ${lead.message}
Services: ${lead.services.join(", ") || "none selected"}
Form: ${lead.meta.form_title || "unknown"}
reCAPTCHA: ${lead.meta.recaptcha_score ?? "not available"}
Source URL: ${lead.meta.source_url || "unknown"}`;

      const { text } = await callClaude({
        tier: "research",
        systemPrompt: QUALIFICATION_PROMPT,
        userMessage,
        maxTokens: 256,
        temperature: 0.2,
      });

      const parsed = parseClaudeJson(text) as { score: number; reasoning: string };
      const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const reasoning = parsed.reasoning || "";

      const isQualified = score >= LEAD_THRESHOLDS.autoSend;
      const isSpam = score < LEAD_THRESHOLDS.spam;

      await supabase.from("lead_scores").upsert({
        lead_id: lead.id,
        score,
        reasoning,
        qualified: isQualified,
        spam: isSpam,
        status: isSpam ? "spam" : "new",
        org_id: ORG_ID,
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id" });

      if (isQualified) qualified++;
      else if (isSpam) spam++;
      else review++;

      scores.push({ lead_id: lead.id, score, reasoning });
    } catch (err) {
      console.error(`[qualify] Failed to score ${lead.id}:`, err);
    }
  }

  await createNotification({
    title: `Qualified ${unscored.length} leads`,
    message: `${qualified} genuine, ${review} for review, ${spam} spam`,
    category: "leads",
    priority: qualified > 0 ? "high" : "medium",
    sourceModule: "leads",
    sourceUrl: "/leads",
  });

  return NextResponse.json({
    data: { qualified, review, spam, newScores: scores.length, alreadyScored: leads.length - unscored.length, scores },
  });
}
