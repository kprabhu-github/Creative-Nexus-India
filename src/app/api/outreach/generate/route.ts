// ---------------------------------------------------------------------------
// POST /api/outreach/generate — W10: Generate Campaign Sequences + Messages
// ---------------------------------------------------------------------------
// Orchestrates agents A25 (Outbound Sequence Architect), A26 (Cold Email
// Copywriter), and A27 (LinkedIn Outreach Agent) to produce a complete
// multi-channel outreach campaign with email copy and LinkedIn messages.
//
// Returns the full campaign synchronously: sequence design, email copy with
// A/B variants, and LinkedIn connection + follow-up messaging.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ToneSchema = z.enum(["professional", "casual", "direct"]);

const OutreachInputSchema = z.object({
  campaignName: z.string().min(3).max(200),
  icpId: z.string().uuid().optional(),
  targetRole: z.string().min(2).max(200),
  targetIndustry: z.string().min(2).max(200),
  productValue: z.string().min(10).max(3000),
  tone: ToneSchema.optional().default("professional"),
});

type OutreachInput = z.infer<typeof OutreachInputSchema>;

// ---------------------------------------------------------------------------
// Type definitions for agent outputs
// ---------------------------------------------------------------------------

interface SequenceStep {
  step: number;
  channel: "email" | "linkedin";
  timing: string;
  subject_or_hook: string;
  purpose: string;
  personalisation_variables: string[];
}

interface SequenceOutput {
  campaign_name: string;
  total_steps: number;
  sequence: SequenceStep[];
}

interface EmailVariant {
  subject_line: string;
}

interface EmailStep {
  step: number;
  subject_line: string;
  opening_hook: string;
  body: string;
  cta: string;
  ab_variants: EmailVariant[];
}

interface EmailCopyOutput {
  emails: EmailStep[];
}

interface EngagementPrompt {
  context: string;
  comment: string;
}

interface LinkedInOutput {
  connection_request: string;
  follow_up_message: string;
  engagement_prompts: EngagementPrompt[];
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const A25_SYSTEM_PROMPT = `You are an outbound campaign architect for a B2B marketing agency. Design a 5-step multi-channel campaign sequence that combines email and LinkedIn touchpoints for maximum response rate.

For each step specify:
1. step — sequential number (1-5)
2. channel — "email" or "linkedin"
3. timing — days after previous step (e.g. "Day 0", "Day 3", "Day 7")
4. subject_or_hook — email subject line or LinkedIn hook
5. purpose — what this step achieves (awareness, social proof, urgency, etc.)
6. personalisation_variables — list of variables to personalise (e.g. "company_name", "recent_funding", "mutual_connection")

Design principles:
- Start with LinkedIn connection request (warm the relationship)
- Follow up with email after connection is accepted or after 2 days
- Alternate channels to avoid being perceived as spam
- Escalate value proposition across steps (don't give everything in step 1)
- Final step should create urgency or offer a specific call-to-action

Return ONLY valid JSON:
{
  "campaign_name": "...",
  "total_steps": 5,
  "sequence": [
    { "step": 1, "channel": "linkedin", "timing": "Day 0", "subject_or_hook": "...", "purpose": "...", "personalisation_variables": [...] }
  ]
}`;

function buildA26SystemPrompt(tone: string): string {
  return `You are a cold email copywriter for a B2B marketing agency. Given a campaign sequence and target persona, write the full copy for each EMAIL step in the sequence.

For each email step, produce:
1. subject_line — compelling, under 60 characters, no clickbait
2. opening_hook — research-backed opening line that references something specific about the prospect (NOT generic like "I noticed your company...")
3. body — under 150 words, focused on value not features, conversational
4. cta — single clear call-to-action (question format preferred)
5. ab_variants — 2 alternative subject lines for A/B testing

Tone: ${tone}
${tone === "professional" ? "Use formal but warm language. Avoid slang. Address pain points directly." : ""}
${tone === "casual" ? "Write like a peer, not a salesperson. Use conversational language and short sentences." : ""}
${tone === "direct" ? "Get straight to the point. No fluff. Lead with the strongest value proposition." : ""}

Writing rules:
- No "I hope this email finds you well" or any variation
- No "As a [role], you probably..." openings
- Each email must stand alone (prospect may not have seen previous ones)
- Include a soft opt-out in the final email ("If this isn't relevant, no worries — just let me know")
- Use the prospect's first name, not "Dear Sir/Madam"

Return ONLY valid JSON:
{
  "emails": [
    { "step": 1, "subject_line": "...", "opening_hook": "...", "body": "...", "cta": "...", "ab_variants": [{ "subject_line": "..." }, { "subject_line": "..." }] }
  ]
}`;
}

function buildA27SystemPrompt(tone: string): string {
  return `You are a LinkedIn outreach specialist for a B2B marketing agency. Write highly personalised LinkedIn messaging assets.

Produce:
1. connection_request — under 300 characters, personalised, gives a reason to connect (NOT "I'd like to add you to my professional network")
2. follow_up_message — sent after connection is accepted, value-first approach, leads toward a conversation (under 500 characters)
3. engagement_prompts — 3 comments to write on the prospect's recent posts (each with context of what kind of post it responds to, and the actual comment text)

Tone: ${tone}
${tone === "professional" ? "Maintain executive-level professionalism. Reference industry trends." : ""}
${tone === "casual" ? "Be genuine and conversational. Comment like a peer, not a vendor." : ""}
${tone === "direct" ? "Be bold and specific. Lead with results and data." : ""}

Rules:
- Connection request MUST be under 300 characters (LinkedIn limit)
- Never mention your product in the connection request — focus on shared interests or genuine curiosity
- Follow-up should provide value before asking for anything
- Engagement comments should be substantive (not just "Great post!")
- Each comment should demonstrate domain expertise

Return ONLY valid JSON:
{
  "connection_request": "...",
  "follow_up_message": "...",
  "engagement_prompts": [
    { "context": "Post about [topic]", "comment": "..." }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Step executors
// ---------------------------------------------------------------------------

async function designSequence(input: OutreachInput): Promise<SequenceOutput> {
  const userMessage = [
    `## Campaign Brief`,
    `Campaign Name: ${input.campaignName}`,
    `Target Role: ${input.targetRole}`,
    `Target Industry: ${input.targetIndustry}`,
    `Product Value Proposition: ${input.productValue}`,
    `Desired Tone: ${input.tone}`,
  ].join("\n");

  const response = await callClaude({
    tier: "execution",
    systemPrompt: A25_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
    temperature: 0.4,
  });

  return parseClaudeJson<SequenceOutput>(response.text);
}

async function writeEmailCopy(
  sequence: SequenceOutput,
  input: OutreachInput,
): Promise<EmailCopyOutput> {
  const emailSteps = sequence.sequence.filter((s) => s.channel === "email");

  const userMessage = [
    `## Campaign Sequence\n${JSON.stringify(sequence, null, 2)}`,
    `## Email Steps to Write Copy For\n${JSON.stringify(emailSteps, null, 2)}`,
    `## Target Persona`,
    `Role: ${input.targetRole}`,
    `Industry: ${input.targetIndustry}`,
    `Product Value: ${input.productValue}`,
  ].join("\n\n");

  const response = await callClaude({
    tier: "execution",
    systemPrompt: buildA26SystemPrompt(input.tone),
    userMessage,
    maxTokens: 4096,
    temperature: 0.5,
  });

  return parseClaudeJson<EmailCopyOutput>(response.text);
}

async function writeLinkedInMessages(
  sequence: SequenceOutput,
  input: OutreachInput,
): Promise<LinkedInOutput> {
  const linkedinSteps = sequence.sequence.filter(
    (s) => s.channel === "linkedin",
  );

  const userMessage = [
    `## Campaign Sequence\n${JSON.stringify(sequence, null, 2)}`,
    `## LinkedIn Steps\n${JSON.stringify(linkedinSteps, null, 2)}`,
    `## Target Persona`,
    `Role: ${input.targetRole}`,
    `Industry: ${input.targetIndustry}`,
    `Product Value: ${input.productValue}`,
  ].join("\n\n");

  const response = await callClaude({
    tier: "execution",
    systemPrompt: buildA27SystemPrompt(input.tone),
    userMessage,
    maxTokens: 2048,
    temperature: 0.5,
  });

  return parseClaudeJson<LinkedInOutput>(response.text);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function storeCampaign(
  input: OutreachInput,
  sequence: SequenceOutput,
  emails: EmailCopyOutput,
  linkedinMessages: LinkedInOutput,
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("gtm_campaigns")
    .insert({
      org_id: ORG_ID,
      icp_id: input.icpId ?? null,
      name: input.campaignName,
      target_role: input.targetRole,
      target_industry: input.targetIndustry,
      product_value: input.productValue,
      tone: input.tone,
      sequence: sequence.sequence,
      emails: emails.emails,
      linkedin_messages: linkedinMessages,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to store campaign:", error?.message);
    throw new Error(
      `Failed to store campaign: ${error?.message ?? "unknown error"}`,
    );
  }

  return data.id as string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = OutreachInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const input = parsed.data;

    // -----------------------------------------------------------------------
    // Step 1: A25 Outbound Sequence Architect — design the 5-step sequence
    // -----------------------------------------------------------------------
    const sequence = await designSequence(input);

    // -----------------------------------------------------------------------
    // Steps 2 & 3 can run in parallel: email copy + LinkedIn messages
    // Both depend on the sequence but not on each other
    // -----------------------------------------------------------------------
    const [emails, linkedinMessages] = await Promise.all([
      writeEmailCopy(sequence, input),
      writeLinkedInMessages(sequence, input),
    ]);

    // -----------------------------------------------------------------------
    // Step 4: Store campaign in gtm_campaigns
    // -----------------------------------------------------------------------
    const campaignId = await storeCampaign(
      input,
      sequence,
      emails,
      linkedinMessages,
    );

    // -----------------------------------------------------------------------
    // Step 5: Push notification — campaign ready
    // -----------------------------------------------------------------------
    await createNotification({
      title: "Campaign Ready",
      message: `Outreach campaign "${input.campaignName}" generated with ${sequence.sequence.length}-step sequence, email copy, and LinkedIn messages.`,
      category: "outreach",
      priority: "high",
      sourceModule: "nexus-flow",
      sourceUrl: "/nexus-flow",
      actions: [{ label: "View Campaign", url: "/nexus-flow" }],
    });

    // -----------------------------------------------------------------------
    // Step 6: Return assembled response
    // -----------------------------------------------------------------------
    return NextResponse.json(
      {
        data: {
          campaignId,
          campaign: {
            sequence: sequence.sequence,
            emails: emails.emails,
            linkedinMessages,
          },
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/outreach/generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
