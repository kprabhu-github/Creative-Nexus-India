// ---------------------------------------------------------------------------
// POST /api/gtm/icp — W9: Build ICP + Generate Leads
// ---------------------------------------------------------------------------
// Orchestrates agents A22 (ICP Architect), A23 (Intent Signal Analyst), and
// A24 (Lead List Builder) to produce an Ideal Customer Profile with scored
// leads and go-to-market recommendations.
//
// The response is returned synchronously (all steps run in sequence) so the
// caller receives the full ICP, intent signals, leads, and recommendations
// in one payload. For very large competitor lists this may take 30-60 seconds.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { ragBrowse, type CrawlResult } from "@/lib/apify";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const IcpInputSchema = z.object({
  productDescription: z.string().min(10).max(5000),
  targetMarket: z.string().min(5).max(2000),
  idealBuyer: z.string().min(3).max(2000),
  competitors: z.array(z.string().max(500)).max(10).optional().default([]),
});

type IcpInput = z.infer<typeof IcpInputSchema>;

// ---------------------------------------------------------------------------
// Type definitions for agent outputs
// ---------------------------------------------------------------------------

interface Firmographics {
  company_size: string;
  industry: string;
  tech_stack: string[];
  funding_stage: string;
  revenue_range: string;
}

interface BuyerPersona {
  title: string;
  seniority: string;
  pain_points: string[];
  goals: string[];
  decision_authority: string;
}

interface ScoringFactor {
  factor: string;
  weight: number;
  description: string;
}

interface IcpDocument {
  firmographics: Firmographics;
  buyer_personas: BuyerPersona[];
  buying_triggers: string[];
  disqualification_criteria: string[];
  scoring_rubric: {
    scale: string;
    factors: ScoringFactor[];
  };
}

interface IntentSignals {
  signals: Array<{
    source: string;
    signal: string;
    strength: string;
    interpretation: string;
  }>;
  summary: string;
}

interface LeadEntry {
  company_name: string;
  company_domain: string;
  industry: string;
  employee_count: string;
  funding_stage: string;
  revenue_range: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_linkedin: string;
  icp_score: number;
  rationale: string;
}

interface LeadListOutput {
  leads: LeadEntry[];
  gtm_recommendations: string[];
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const A22_SYSTEM_PROMPT = `You are an ICP (Ideal Customer Profile) architect for a B2B marketing agency. Given the product description, target market, and ideal buyer, produce a structured ICP document.

Your output MUST include:
1. firmographics — company_size (employee range), industry (vertical), tech_stack (common tools they use), funding_stage (seed/A/B/C/growth/public), revenue_range
2. buyer_personas — exactly 3 detailed personas, each with: title, seniority, pain_points (3-5), goals (3-5), decision_authority (primary/influencer/champion)
3. buying_triggers — at least 5 signals that indicate the company is ready to buy
4. disqualification_criteria — at least 3 reasons to exclude a prospect
5. scoring_rubric — a 0-100 scale with weighted factors (each factor has: factor name, weight as percentage, description)

Return ONLY valid JSON matching this structure:
{
  "firmographics": { "company_size": "...", "industry": "...", "tech_stack": [...], "funding_stage": "...", "revenue_range": "..." },
  "buyer_personas": [{ "title": "...", "seniority": "...", "pain_points": [...], "goals": [...], "decision_authority": "..." }],
  "buying_triggers": [...],
  "disqualification_criteria": [...],
  "scoring_rubric": { "scale": "0-100", "factors": [{ "factor": "...", "weight": 0, "description": "..." }] }
}

Be specific to the Indian B2B market when relevant. Use concrete numbers and real tool names rather than generic placeholders.`;

const A23_SYSTEM_PROMPT = `You are an intent signal analyst for a B2B marketing agency. Given competitor intelligence data gathered from the web, identify buying signals and intent indicators.

Analyse the competitor content for:
1. Pain points their customers are experiencing (mentioned in case studies, testimonials, blog posts)
2. Technology adoption signals (tools being discussed, integrations mentioned)
3. Growth indicators (hiring patterns, funding news, expansion signals)
4. Content consumption patterns (what topics are trending in this space)
5. Competitive displacement signals (companies switching providers)

Return ONLY valid JSON:
{
  "signals": [
    { "source": "competitor domain or context", "signal": "description of the signal", "strength": "strong|moderate|weak", "interpretation": "what this means for prospecting" }
  ],
  "summary": "2-3 sentence overview of the intent landscape"
}

Focus on actionable intelligence, not generic observations.`;

const A24_SYSTEM_PROMPT = `You are a B2B lead list builder for a marketing agency targeting the Indian market. Given an ICP document and intent signals, generate a list of 10 realistic sample leads that match the ICP criteria.

IMPORTANT: These are AI-generated representative leads based on the ICP criteria — NOT real people. Generate realistic-sounding Indian B2B companies and contacts that match the profile. Use plausible:
- Indian company names (mix of well-known and realistic-sounding startups)
- Indian contact names
- Realistic job titles matching the buyer personas
- .com or .in domains
- Professional email formats (firstname@companydomain)
- LinkedIn-style URLs

For each lead, include:
- company_name, company_domain, industry, employee_count (range), funding_stage, revenue_range
- contact_name, contact_title, contact_email, contact_linkedin
- icp_score (0-100, based on the scoring rubric)
- rationale (1-2 sentences explaining why this lead scores as it does)

Also provide 5-7 GTM recommendations for approaching these leads.

Return ONLY valid JSON:
{
  "leads": [{ "company_name": "...", "company_domain": "...", "industry": "...", "employee_count": "...", "funding_stage": "...", "revenue_range": "...", "contact_name": "...", "contact_title": "...", "contact_email": "...", "contact_linkedin": "...", "icp_score": 0, "rationale": "..." }],
  "gtm_recommendations": [...]
}

Make the leads diverse across sub-segments of the ICP. Ensure scores vary realistically (not all 90+).`;

// ---------------------------------------------------------------------------
// Step executors
// ---------------------------------------------------------------------------

async function buildIcp(input: IcpInput): Promise<IcpDocument> {
  const userMessage = [
    `## Product Description\n${input.productDescription}`,
    `## Target Market\n${input.targetMarket}`,
    `## Ideal Buyer Roles\n${input.idealBuyer}`,
    input.competitors.length > 0
      ? `## Known Competitors\n${input.competitors.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await callClaude({
    tier: "strategy",
    systemPrompt: A22_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4096,
    temperature: 0.4,
  });

  return parseClaudeJson<IcpDocument>(response.text);
}

async function researchCompetitors(
  competitors: string[],
): Promise<CrawlResult[]> {
  if (competitors.length === 0) {
    return [];
  }

  const results: CrawlResult[] = [];

  // Research each competitor sequentially to avoid overwhelming the Apify API
  for (const domain of competitors) {
    try {
      const query = `${domain} customers case studies testimonials pricing`;
      const crawled = await ragBrowse({ query, maxResults: 3 });
      results.push(...crawled);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ragBrowse failed for competitor ${domain}:`, message);
      // Continue with remaining competitors — partial data is still useful
    }
  }

  return results;
}

async function analyseIntentSignals(
  competitorData: CrawlResult[],
  icpContext: string,
): Promise<IntentSignals> {
  const competitorContent = competitorData
    .map(
      (item) =>
        `--- Source: ${item.url} ---\n${item.title ? `Title: ${item.title}\n` : ""}${item.text.slice(0, 2000)}`,
    )
    .join("\n\n");

  const userMessage = [
    `## ICP Context\n${icpContext}`,
    `## Competitor Intelligence\n${competitorContent || "No competitor data was available. Provide general intent signals based on the ICP context alone."}`,
  ].join("\n\n");

  const response = await callClaude({
    tier: "research",
    systemPrompt: A23_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
    temperature: 0.3,
  });

  return parseClaudeJson<IntentSignals>(response.text);
}

async function generateLeads(
  icp: IcpDocument,
  intentSignals: IntentSignals,
): Promise<LeadListOutput> {
  const userMessage = [
    `## ICP Document\n${JSON.stringify(icp, null, 2)}`,
    `## Intent Signals\n${JSON.stringify(intentSignals, null, 2)}`,
  ].join("\n\n");

  const response = await callClaude({
    tier: "execution",
    systemPrompt: A24_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 4096,
    temperature: 0.5,
  });

  return parseClaudeJson<LeadListOutput>(response.text);
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function storeIcp(
  input: IcpInput,
  icp: IcpDocument,
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("gtm_icps")
    .insert({
      org_id: ORG_ID,
      name: `ICP — ${input.targetMarket?.substring(0, 50) || "Default"}`,
      description: input.productDescription?.substring(0, 200),
      product_description: input.productDescription,
      target_market: input.targetMarket,
      ideal_buyer: input.idealBuyer,
      competitors: input.competitors,
      firmographics: icp.firmographics,
      buyer_personas: icp.buyer_personas,
      buying_triggers: icp.buying_triggers,
      disqualification_criteria: icp.disqualification_criteria,
      scoring_rubric: icp.scoring_rubric,
      full_icp: icp,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to store ICP:", error?.message);
    throw new Error(`Failed to store ICP: ${error?.message ?? "unknown error"}`);
  }

  return data.id as string;
}

async function storeLeads(
  icpId: string,
  leads: LeadEntry[],
): Promise<string[]> {
  const supabase = createAdminClient();

  const rows = leads.map((lead) => ({
    org_id: ORG_ID,
    icp_id: icpId,
    name: lead.contact_name || lead.company_name,
    company: lead.company_name,
    title: lead.contact_title,
    email: lead.contact_email,
    icp_fit_score: lead.icp_score,
    icp_score: lead.icp_score,
    intent_score: 50,
    qualification_tier: lead.icp_score >= 80 ? "A" : lead.icp_score >= 60 ? "B" : lead.icp_score >= 40 ? "C" : "D",
    industry: lead.industry,
    company_domain: lead.company_domain,
    company_size: lead.employee_count,
    funding_stage: lead.funding_stage,
    linkedin_url: lead.contact_linkedin,
    reasoning: lead.rationale,
    intent_signals: [],
    enrichment_data: { revenue_range: lead.revenue_range, rationale: lead.rationale },
    source: "ai_generated",
    status: "new",
  }));

  const { data, error } = await supabase
    .from("gtm_leads")
    .insert(rows)
    .select("id");

  if (error || !data) {
    console.error("Failed to store leads:", error?.message);
    throw new Error(`Failed to store leads: ${error?.message ?? "unknown error"}`);
  }

  return data.map((row) => row.id as string);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = IcpInputSchema.safeParse(body);

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
    // Step 1: A22 ICP Architect — build the ICP (strategy tier / Opus)
    // -----------------------------------------------------------------------
    const icp = await buildIcp(input);

    // -----------------------------------------------------------------------
    // Step 2: Store the ICP in gtm_icps
    // -----------------------------------------------------------------------
    const icpId = await storeIcp(input, icp);

    // -----------------------------------------------------------------------
    // Step 3: Research competitors via ragBrowse for intent signals
    // -----------------------------------------------------------------------
    const competitorData = await researchCompetitors(input.competitors);

    // -----------------------------------------------------------------------
    // Step 4: A23 Intent Signal Analyst — identify buying signals (research tier / Haiku)
    // -----------------------------------------------------------------------
    const icpContext = `Product: ${input.productDescription}\nMarket: ${input.targetMarket}\nBuyer: ${input.idealBuyer}`;
    const intentSignals = await analyseIntentSignals(competitorData, icpContext);

    // -----------------------------------------------------------------------
    // Step 5: A24 Lead List Builder — generate sample leads (execution tier / Sonnet)
    // -----------------------------------------------------------------------
    const leadListOutput = await generateLeads(icp, intentSignals);

    // -----------------------------------------------------------------------
    // Step 6: Store leads in gtm_leads
    // -----------------------------------------------------------------------
    const leadIds = await storeLeads(icpId, leadListOutput.leads);

    // -----------------------------------------------------------------------
    // Step 7: Return assembled response
    // -----------------------------------------------------------------------
    return NextResponse.json(
      {
        data: {
          icpId,
          icp,
          intentSignals,
          leads: leadListOutput.leads.map((lead, idx) => ({
            id: leadIds[idx],
            ...lead,
          })),
          gtmRecommendations: leadListOutput.gtm_recommendations,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/gtm/icp error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
