// ---------------------------------------------------------------------------
// Agent execution types — shared between API routes and frontend
// ---------------------------------------------------------------------------

/** All workflow codes in the Signal Engine. */
export type WorkflowCode =
  | "W1"  // Strategy Sprint
  | "W2"  // Content Plan
  | "W3"  // Social Calendar
  | "W4"  // SEO Brief
  | "W5"  // Email Sequence
  | "W6"  // Ad Copy
  | "W7"  // Client Onboarding
  | "W8"  // Competitor Analysis
  | "W9"  // Social Intelligence
  | "W10" // GTM Pipeline
  | "W11" // Lead Scoring
  | "W12" // Social Deep Dive
  | "W13"; // WhatsApp Sales

/** All agent codes in the system. */
export type AgentCode =
  | "A01" // Brand Intel Researcher
  | "A02" // Audience Insight Analyst
  | "A03" // Brand Strategist
  | "A04" // Content Strategist
  | "A05" // SEO Researcher
  | "A06" // Social Planner
  | "A07" // Email Copywriter
  | "A08" // Ad Copywriter
  | "A09" // Competitor Analyst
  | "A10" // Quality Auditor
  | string; // Allow future agents

/** Status of a workflow run. */
export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Status of a single agent execution within a run. */
export type AgentRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/** Input payload for starting a workflow run. */
export interface WorkflowRunInput {
  workflowCode: WorkflowCode;
  clientDomain: string;
  competitors?: string[];
  targetAudience?: string;
  clientId?: string;
  orgId?: string;
  userId?: string;
  additionalContext?: string;
}

/** A row in sig_runs. */
export interface SigRun {
  id: string;
  org_id: string | null;
  client_id: string | null;
  workflow_code: WorkflowCode;
  status: RunStatus;
  progress: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A row in sig_agent_runs. */
export interface SigAgentRun {
  id: string;
  run_id: string;
  agent_code: AgentCode;
  agent_name: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Response shape for the run status endpoint. */
export interface RunStatusResponse {
  run: SigRun;
  agentRuns: SigAgentRun[];
}

/** Response shape for the run trigger endpoint. */
export interface RunTriggerResponse {
  runId: string;
  status: RunStatus;
  message: string;
}
