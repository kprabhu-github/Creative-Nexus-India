// ---------------------------------------------------------------------------
// Anthropic Claude API — raw fetch wrapper (no SDK dependency)
// ---------------------------------------------------------------------------
// Base URL: https://api.anthropic.com/v1/messages
// Auth: x-api-key header
// Docs: https://docs.anthropic.com/en/api/messages
// ---------------------------------------------------------------------------

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/** Model tiers mapped to their intended usage across the platform. */
export const CLAUDE_MODELS = {
  /** Strategy-grade: complex reasoning, brand strategy, high-stakes output. */
  strategy: "claude-opus-4-20250514",
  /** Execution-grade: content generation, structured extraction, DAG agents. */
  execution: "claude-sonnet-4-6-20250514",
  /** Research-grade: classification, summarisation, low-latency tasks. */
  research: "claude-haiku-4-5-20250514",
} as const;

export type ClaudeModelTier = keyof typeof CLAUDE_MODELS;

export interface ClaudeMessageOptions {
  /** Which model tier to use. */
  tier: ClaudeModelTier;
  /** System prompt (instructions for the agent). */
  systemPrompt: string;
  /** User message content. */
  userMessage: string;
  /** Max tokens to generate. Defaults to 4096. */
  maxTokens?: number;
  /** Sampling temperature. Defaults to 0.4 for deterministic output. */
  temperature?: number;
}

/** Shape of a single content block returned by the API. */
interface ContentBlock {
  type: string;
  text?: string;
}

/** Minimal shape of the Messages API response we care about. */
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicErrorBody {
  type: string;
  error: {
    type: string;
    message: string;
  };
}

/**
 * Send a single-turn message to the Anthropic Messages API and return the
 * assistant's text response.
 *
 * Throws a descriptive error on HTTP or API failures. Retries once on 529
 * (overloaded) with a 2-second backoff.
 */
export async function callClaude(
  options: ClaudeMessageOptions,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }

  const {
    tier,
    systemPrompt,
    userMessage,
    maxTokens = 4096,
    temperature = 0.4,
  } = options;

  const model = CLAUDE_MODELS[tier];

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user" as const,
        content: userMessage,
      },
    ],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_API_VERSION,
  };

  let lastError: Error | null = null;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(ANTHROPIC_BASE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // Handle overloaded — back off and retry once
      if (response.status === 529 && attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }

      // Handle rate limit — back off and retry once
      if (response.status === 429 && attempt < MAX_RETRIES - 1) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as AnthropicErrorBody | null;
        const errorMessage = errorBody?.error?.message ?? `HTTP ${response.status}`;
        throw new Error(
          `Anthropic API error (${response.status}): ${errorMessage}`,
        );
      }

      const data = (await response.json()) as AnthropicResponse;

      // Extract text from content blocks
      const textBlocks = data.content.filter(
        (block): block is ContentBlock & { text: string } =>
          block.type === "text" && typeof block.text === "string",
      );

      if (textBlocks.length === 0) {
        throw new Error("Anthropic API returned no text content blocks");
      }

      return {
        text: textBlocks.map((b) => b.text).join("\n"),
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Anthropic API call failed after retries");
}

/**
 * Parse a Claude response that is expected to contain JSON.
 *
 * Handles the common case where Claude wraps JSON in a markdown code fence.
 * Returns the parsed object or throws if parsing fails.
 */
export function parseClaudeJson<T = Record<string, unknown>>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `Failed to parse Claude response as JSON. First 200 chars: ${cleaned.slice(0, 200)}`,
    );
  }
}
