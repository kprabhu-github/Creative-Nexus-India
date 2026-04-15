// ---------------------------------------------------------------------------
// POST /api/agents/run — Trigger a workflow run
// ---------------------------------------------------------------------------
// Accepts a workflow trigger request, creates tracking records in Supabase,
// executes agents sequentially, and stores results. Returns the run ID
// immediately after creating the run record; agents execute in the
// background via a non-blocking promise.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, parseClaudeJson } from "@/lib/anthropic";
import { crawlWebsite } from "@/lib/apify";
import type {
  WorkflowCode,
  AgentCode,
  RunStatus,
  AgentRunStatus,
} from "@/types/agents";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RunInputSchema = z.object({
  workflowCode: z.string().min(1).max(10),
  clientDomain: z.string().min(1).max(500),
  competitors: z.array(z.string().max(500)).optional().default([]),
  targetAudience: z.string().max(5000).optional().default(""),
  clientId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  additionalContext: z.string().max(10000).optional().default(""),
});

// ---------------------------------------------------------------------------
// Agent definitions for W7 (Client Onboarding)
// ---------------------------------------------------------------------------

interface AgentDefinition {
  code: AgentCode;
  name: string;
  systemPrompt: string;
  tier: "strategy" | "execution" | "research";
  /** Whether this agent should also invoke Apify for web scraping. */
  needsScrape: boolean;
}

const W7_AGENTS: AgentDefinition[] = [
  {
    code: "A01",
    name: "Brand Intel Researcher",
    tier: "research",
    needsScrape: true,
    systemPrompt: `You are a brand intelligence researcher. Given a company's website content, extract:
- Company positioning (what they do, for whom, how they differentiate)
- Key products/services (name, description, pricing signals)
- Target audience signals (who they are writing for, language cues, pain points addressed)
- Brand voice characteristics (formal/casual, technical/accessible, tone descriptors)
- Unique value propositions (what makes them stand out)
- Competitive differentiators (how they position against alternatives)

Return your analysis as structured JSON with these exact keys:
{
  "positioning": { "statement": "...", "category": "...", "differentiator": "..." },
  "products": [{ "name": "...", "description": "...", "pricingSignal": "..." }],
  "audienceSignals": { "primaryAudience": "...", "languageCues": [...], "painPointsAddressed": [...] },
  "voiceCharacteristics": { "formality": "...", "technicality": "...", "toneDescriptors": [...], "examplePhrases": [...] },
  "valuePropositions": [...],
  "competitiveDifferentiators": [...]
}

Be thorough but factual. Only include information you can directly extract or reasonably infer from the provided content. Do not fabricate specific data points.`,
  },
  {
    code: "A02",
    name: "Audience Insight Analyst",
    tier: "execution",
    needsScrape: false,
    systemPrompt: `You are an audience insight analyst. Given brand intelligence data, create detailed buyer personas.

For each persona, include:
- Name and title (representative, not a real person)
- Demographics: age range, location type, income bracket, education
- Psychographics: values, lifestyle, interests, media consumption
- Pain points: specific frustrations the brand can solve
- Buying triggers: what motivates them to purchase
- Preferred channels: where they spend time online
- Content preferences: what format/topics they engage with
- Objections: what might prevent them from buying

Return structured JSON with 2-3 personas:
{
  "personas": [
    {
      "name": "...",
      "title": "...",
      "demographics": { "ageRange": "...", "locationType": "...", "incomeBracket": "...", "education": "..." },
      "psychographics": { "values": [...], "lifestyle": "...", "interests": [...], "mediaConsumption": [...] },
      "painPoints": [...],
      "buyingTriggers": [...],
      "preferredChannels": [...],
      "contentPreferences": { "formats": [...], "topics": [...], "frequency": "..." },
      "objections": [...]
    }
  ],
  "commonThemes": { "sharedPainPoints": [...], "universalTriggers": [...] }
}

Base all insights on the brand intelligence data provided. Be specific and actionable, not generic.`,
  },
  {
    code: "A03",
    name: "Brand Strategist",
    tier: "strategy",
    needsScrape: false,
    systemPrompt: `You are a senior brand strategist at a top-tier agency. Given brand intelligence and audience insights, produce a comprehensive brand brief.

Your output must include:
1. Positioning statement (structured: For [target], [brand] is the [category] that [benefit] because [reason to believe])
2. Voice guidelines:
   - Tone spectrum (where the brand sits on key dimensions)
   - Vocabulary recommendations (words to use)
   - Banned phrases (words/phrases to never use)
   - Writing style rules (sentence length, jargon policy, etc.)
3. Content pillars (5-7 topics the brand should consistently create content about)
   - Each with: name, description, key themes, sample topics
4. Competitor positioning map:
   - Where the brand sits relative to competitors on key dimensions
5. Content strategy recommendations:
   - Channel priorities
   - Content mix (educational/promotional/entertainment ratio)
   - Frequency recommendations per channel
   - Quick win opportunities

Return structured JSON:
{
  "positioningStatement": { "target": "...", "brand": "...", "category": "...", "benefit": "...", "reasonToBelieve": "..." },
  "voiceGuidelines": {
    "toneSpectrum": [{ "dimension": "...", "position": "...", "description": "..." }],
    "vocabulary": { "preferred": [...], "avoid": [...] },
    "bannedPhrases": [...],
    "writingRules": [...]
  },
  "contentPillars": [{ "name": "...", "description": "...", "keyThemes": [...], "sampleTopics": [...] }],
  "competitorPositioning": { "dimensions": [...], "brandPosition": "...", "competitors": [...] },
  "strategyRecommendations": {
    "channelPriorities": [...],
    "contentMix": { "educational": 0, "promotional": 0, "entertainment": 0 },
    "frequencyByChannel": [...],
    "quickWins": [...]
  }
}

Be strategic and opinionated. Provide clear, actionable guidance that a content team can immediately execute.`,
  },
];

// ---------------------------------------------------------------------------
// Workflow registry
// ---------------------------------------------------------------------------

const WORKFLOW_AGENTS: Record<string, AgentDefinition[]> = {
  W7: W7_AGENTS,
};

// ---------------------------------------------------------------------------
// Helper: update run status in Supabase
// ---------------------------------------------------------------------------

async function updateRunStatus(
  runId: string,
  updates: {
    status?: RunStatus;
    progress?: number;
    output?: Record<string, unknown>;
    error?: string;
    started_at?: string;
    completed_at?: string;
  },
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sig_runs")
    .update(updates)
    .eq("id", runId);

  if (error) {
    console.error(`Failed to update run ${runId}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Helper: create agent run record
// ---------------------------------------------------------------------------

async function createAgentRun(
  runId: string,
  agent: AgentDefinition,
  input: Record<string, unknown>,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sig_agent_runs")
    .insert({
      run_id: runId,
      agent_code: agent.code,
      agent_name: agent.name,
      status: "pending" as AgentRunStatus,
      input,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create agent run record: ${error?.message}`);
  }

  return data.id as string;
}

// ---------------------------------------------------------------------------
// Helper: update agent run record
// ---------------------------------------------------------------------------

async function updateAgentRun(
  agentRunId: string,
  updates: {
    status?: AgentRunStatus;
    output?: Record<string, unknown>;
    error?: string;
    tokens_in?: number;
    tokens_out?: number;
    duration_ms?: number;
    started_at?: string;
    completed_at?: string;
  },
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sig_agent_runs")
    .update(updates)
    .eq("id", agentRunId);

  if (error) {
    console.error(`Failed to update agent run ${agentRunId}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Core: execute a single agent
// ---------------------------------------------------------------------------

async function executeAgent(
  agent: AgentDefinition,
  runId: string,
  agentInput: Record<string, unknown>,
  previousOutputs: Record<string, Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const agentRunId = await createAgentRun(runId, agent, agentInput);
  const startTime = Date.now();

  await updateAgentRun(agentRunId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  try {
    // Build the user message from input + any scraped content + previous agent outputs
    let userMessage = "";

    // For A01: scrape the client website first
    if (agent.needsScrape && agentInput.clientDomain) {
      const domain = agentInput.clientDomain as string;
      const url = domain.startsWith("http") ? domain : `https://${domain}`;

      try {
        const crawlResults = await crawlWebsite({
          startUrls: [url],
          maxCrawlPages: 8,
          maxCrawlDepth: 1,
        });

        const websiteContent = crawlResults
          .map((page) => `--- Page: ${page.url} ---\n${page.title ? `Title: ${page.title}\n` : ""}${page.text.slice(0, 3000)}`)
          .join("\n\n");

        userMessage += `## Website Content (${domain})\n\n${websiteContent}\n\n`;
      } catch (scrapeError) {
        const scrapeMessage = scrapeError instanceof Error
          ? scrapeError.message
          : String(scrapeError);
        console.error(`Scrape failed for ${domain}:`, scrapeMessage);
        userMessage += `## Website Content\nNote: Website scraping failed (${scrapeMessage}). Analyse based on the domain name and any other context provided.\n\n`;
      }
    }

    // Add competitor info if available
    if (agentInput.competitors && Array.isArray(agentInput.competitors)) {
      const competitors = agentInput.competitors as string[];
      if (competitors.length > 0) {
        userMessage += `## Competitors\n${competitors.join(", ")}\n\n`;
      }
    }

    // Add target audience if available
    if (agentInput.targetAudience) {
      userMessage += `## Target Audience\n${agentInput.targetAudience}\n\n`;
    }

    // Add additional context
    if (agentInput.additionalContext) {
      userMessage += `## Additional Context\n${agentInput.additionalContext}\n\n`;
    }

    // Add outputs from previous agents
    for (const [prevCode, prevOutput] of Object.entries(previousOutputs)) {
      userMessage += `## Output from Agent ${prevCode}\n${JSON.stringify(prevOutput, null, 2)}\n\n`;
    }

    // If user message is empty, provide domain as minimum context
    if (!userMessage.trim()) {
      userMessage = `Analyse the brand: ${agentInput.clientDomain ?? "unknown domain"}`;
    }

    // Call Claude
    const response = await callClaude({
      tier: agent.tier,
      systemPrompt: agent.systemPrompt,
      userMessage,
      maxTokens: 4096,
      temperature: 0.4,
    });

    const durationMs = Date.now() - startTime;

    // Try to parse as JSON; if it fails, store the raw text
    let output: Record<string, unknown>;
    try {
      output = parseClaudeJson(response.text);
    } catch {
      output = { rawText: response.text };
    }

    await updateAgentRun(agentRunId, {
      status: "completed",
      output,
      tokens_in: response.usage.inputTokens,
      tokens_out: response.usage.outputTokens,
      duration_ms: durationMs,
      completed_at: new Date().toISOString(),
    });

    return output;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    await updateAgentRun(agentRunId, {
      status: "failed",
      error: errorMessage,
      duration_ms: durationMs,
      completed_at: new Date().toISOString(),
    });

    throw new Error(`Agent ${agent.code} (${agent.name}) failed: ${errorMessage}`);
  }
}

// ---------------------------------------------------------------------------
// Core: execute the full workflow (runs in background)
// ---------------------------------------------------------------------------

async function executeWorkflow(
  runId: string,
  workflowCode: WorkflowCode,
  input: Record<string, unknown>,
): Promise<void> {
  const agents = WORKFLOW_AGENTS[workflowCode];
  if (!agents) {
    await updateRunStatus(runId, {
      status: "failed",
      error: `Unknown workflow: ${workflowCode}`,
      completed_at: new Date().toISOString(),
    });
    return;
  }

  await updateRunStatus(runId, {
    status: "running",
    progress: 0,
    started_at: new Date().toISOString(),
  });

  const previousOutputs: Record<string, Record<string, unknown>> = {};
  const totalAgents = agents.length;

  try {
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      // Calculate progress: each agent gets an equal slice
      const progressBefore = Math.round((i / totalAgents) * 100);
      await updateRunStatus(runId, { progress: progressBefore });

      const output = await executeAgent(agent, runId, input, previousOutputs);
      previousOutputs[agent.code] = output;

      const progressAfter = Math.round(((i + 1) / totalAgents) * 100);
      await updateRunStatus(runId, { progress: progressAfter });
    }

    // All agents completed — compile final output
    const compiledOutput: Record<string, unknown> = {
      workflowCode,
      agentOutputs: previousOutputs,
      completedAt: new Date().toISOString(),
    };

    // For W7: create brand brief and deliverable records
    if (workflowCode === "W7") {
      await createBrandBriefAndDeliverable(runId, input, previousOutputs);
    }

    await updateRunStatus(runId, {
      status: "completed",
      progress: 100,
      output: compiledOutput,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await updateRunStatus(runId, {
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// W7-specific: create brand brief + deliverable after completion
// ---------------------------------------------------------------------------

async function createBrandBriefAndDeliverable(
  runId: string,
  input: Record<string, unknown>,
  agentOutputs: Record<string, Record<string, unknown>>,
): Promise<void> {
  const supabase = createAdminClient();
  const orgId = (input.orgId as string) || null;
  const clientId = (input.clientId as string) || null;

  const a01Output = agentOutputs["A01"] ?? {};
  const a02Output = agentOutputs["A02"] ?? {};
  const a03Output = agentOutputs["A03"] ?? {};

  // Create brand brief
  const { error: briefError } = await supabase
    .from("sig_brand_briefs")
    .insert({
      org_id: orgId,
      client_id: clientId,
      run_id: runId,
      version: 1,
      status: "draft",
      positioning: a03Output.positioningStatement ?? a01Output.positioning ?? null,
      voice_guidelines: a03Output.voiceGuidelines ?? null,
      content_pillars: a03Output.contentPillars ?? null,
      competitor_map: a03Output.competitorPositioning ?? null,
      audience_personas: a02Output.personas ? a02Output : null,
      strategy_recommendations: a03Output.strategyRecommendations ?? null,
      full_brief: {
        brandIntel: a01Output,
        audienceInsights: a02Output,
        brandStrategy: a03Output,
      },
    });

  if (briefError) {
    console.error("Failed to create brand brief:", briefError.message);
  }

  // Create deliverable record
  const { error: deliverableError } = await supabase
    .from("sig_deliverables")
    .insert({
      org_id: orgId,
      client_id: clientId,
      run_id: runId,
      title: `Brand Brief — ${input.clientDomain ?? "Client"}`,
      type: "brand_brief",
      format: "json",
      content: {
        brandIntel: a01Output,
        audienceInsights: a02Output,
        brandStrategy: a03Output,
      },
      status: "draft",
    });

  if (deliverableError) {
    console.error("Failed to create deliverable:", deliverableError.message);
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = RunInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      workflowCode,
      clientDomain,
      competitors,
      targetAudience,
      clientId,
      orgId,
      additionalContext,
    } = parsed.data;

    // Validate that the workflow exists in our registry
    if (!WORKFLOW_AGENTS[workflowCode]) {
      return NextResponse.json(
        {
          error: `Workflow "${workflowCode}" is not yet implemented. Available: ${Object.keys(WORKFLOW_AGENTS).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Create the run record
    const inputData = {
      workflowCode,
      clientDomain,
      competitors,
      targetAudience,
      clientId: clientId ?? null,
      orgId: orgId ?? null,
      additionalContext,
    };

    const { data: run, error: insertError } = await supabase
      .from("sig_runs")
      .insert({
        org_id: orgId ?? null,
        client_id: clientId ?? null,
        workflow_code: workflowCode,
        status: "pending" as RunStatus,
        progress: 0,
        input: inputData,
      })
      .select("id")
      .single();

    if (insertError || !run) {
      console.error("Failed to create run:", insertError?.message);
      return NextResponse.json(
        { error: `Failed to create run: ${insertError?.message ?? "unknown error"}` },
        { status: 500 },
      );
    }

    const runId = run.id as string;

    // Kick off the workflow in the background (do not await)
    // The client can poll /api/agents/status/[runId] for progress
    executeWorkflow(
      runId,
      workflowCode as WorkflowCode,
      inputData,
    ).catch((err) => {
      console.error(`Background workflow execution failed for run ${runId}:`, err);
    });

    return NextResponse.json(
      {
        data: {
          runId,
          status: "pending",
          message: `Workflow ${workflowCode} started. Poll /api/agents/status/${runId} for progress.`,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/agents/run error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
