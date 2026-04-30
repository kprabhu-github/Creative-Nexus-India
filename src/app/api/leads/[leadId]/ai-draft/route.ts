// POST /api/leads/[leadId]/ai-draft — generate an AI draft for the lead and
// return { subject, body, default_cc } WITHOUT persisting anything.
//
// Replaces the legacy draft-email flow that wrote to lead_emails. The new flow
// drops the generated text into the unified Conversations composer, which
// sends through the email_threads/email_messages pipeline like every other
// outbound email.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { buildEmailPrompt } from "@/lib/leads/prompts";
import type { EmailType, LeadData } from "@/lib/leads/types";
import { getDefaultCc } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LeadIdParam = z.string().uuid();

const Body = z.object({
  lead_data: z.object({
    id: z.string(),
    name: z.string().nullable().optional(),
    email: z.string().email(),
    phone: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
    services: z.array(z.string()).default([]),
    meta: z.record(z.string(), z.unknown()).default({}),
  }),
  email_type: z.enum([
    "acknowledgement",
    "followup_1",
    "followup_2",
    "followup_3",
    "followup_4",
  ]),
  previous_emails: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } },
) {
  const idCheck = LeadIdParam.safeParse(params.leadId);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
      { status: 400 },
    );
  }

  const { lead_data, email_type, previous_emails } = parsed.data;
  const formTitle = (lead_data.meta.form_title as string) || "contact form";
  const sourceUrl = (lead_data.meta.source_url as string) || "website";

  const userMessage = `Draft an email for this lead:

Name: ${lead_data.name ?? "not provided"}
Email: ${lead_data.email}
Company: ${lead_data.company || "not provided"}
Phone: ${lead_data.phone || "not provided"}
Message they sent: ${lead_data.message || "no message"}
Services interested in: ${lead_data.services.join(", ") || "not specified"}
Form they used: ${formTitle}
Source page: ${sourceUrl}`;

  try {
    const systemPrompt = buildEmailPrompt(email_type as EmailType, previous_emails);
    const { text } = await callClaude({
      tier: "execution",
      systemPrompt,
      userMessage,
      maxTokens: 512,
      temperature: 0.4,
    });

    const result = parseClaudeJson(text) as { subject?: string; body?: string };
    if (!result.subject || !result.body) {
      return NextResponse.json(
        { error: "AI failed to generate valid email content" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        subject: result.subject,
        body: result.body,
        default_cc: getDefaultCc(),
      } satisfies { subject: string; body: string; default_cc: string[] },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI draft failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// LeadData re-export to keep the type used (helps if a future lint complains).
export type { LeadData };
