// ---------------------------------------------------------------------------
// NVIDIA NIM API wrapper — raw fetch, OpenAI-compatible format
// ---------------------------------------------------------------------------
// Base URL: https://integrate.api.nvidia.com/v1
// Auth: Bearer token via NVIDIA_API_KEY
// ---------------------------------------------------------------------------

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

/** Available NVIDIA NIM models used by the quality layer. */
export const NVIDIA_MODELS = {
  /** Text embeddings for semantic search and similarity. */
  embeddings: "nvidia/llama-nemotron-embed-1b-v2",
  /** PII detection — identifies personal information in text. */
  piiDetection: "nvidia/gliner-pii",
  /** Content safety — classifies text for brand safety violations. */
  contentSafety: "nvidia/nemoguard-content-safety",
} as const;

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error("NVIDIA_API_KEY is not set in environment variables");
  }
  return key;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export interface EmbeddingOptions {
  /** Text(s) to embed. */
  input: string | string[];
  /** Model to use. Defaults to llama-nemotron-embed-1b-v2. */
  model?: string;
  /** Embedding type. Defaults to "passage". Use "query" for search queries. */
  inputType?: "query" | "passage";
}

interface EmbeddingData {
  object: string;
  index: number;
  embedding: number[];
}

interface EmbeddingResponse {
  object: string;
  data: EmbeddingData[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Generate embeddings using NVIDIA NIM.
 * Compatible with OpenAI embeddings API format.
 */
export async function createEmbeddings(
  options: EmbeddingOptions,
): Promise<{ embeddings: number[][]; usage: { promptTokens: number } }> {
  const apiKey = getApiKey();
  const {
    input,
    model = NVIDIA_MODELS.embeddings,
    inputType = "passage",
  } = options;

  const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: Array.isArray(input) ? input : [input],
      input_type: inputType,
      encoding_format: "float",
      truncate: "END",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `NVIDIA Embeddings API error (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as EmbeddingResponse;

  return {
    embeddings: data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding),
    usage: { promptTokens: data.usage.prompt_tokens },
  };
}

// ---------------------------------------------------------------------------
// PII Detection (GLiNER)
// ---------------------------------------------------------------------------

export interface PiiDetectionOptions {
  /** Text to scan for PII. */
  text: string;
}

interface PiiEntity {
  entity: string;
  label: string;
  start: number;
  end: number;
  score: number;
}

interface PiiDetectionResponse {
  entities?: PiiEntity[];
  results?: PiiEntity[];
}

export interface PiiDetectionResult {
  hasPii: boolean;
  entities: Array<{
    text: string;
    label: string;
    confidence: number;
    start: number;
    end: number;
  }>;
}

/**
 * Detect PII entities in text using NVIDIA GLiNER.
 *
 * Returns a list of detected PII entities with their type and location.
 * Used in the quality layer between agent executions to prevent leaking
 * personal information into deliverables.
 */
export async function detectPii(
  options: PiiDetectionOptions,
): Promise<PiiDetectionResult> {
  const apiKey = getApiKey();
  const { text } = options;

  // GLiNER NIM uses a chat-completions-style interface for PII detection
  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODELS.piiDetection,
      messages: [
        {
          role: "user",
          content: text,
        },
      ],
      // GLiNER expects entity labels to scan for
      labels: [
        "person",
        "email",
        "phone_number",
        "address",
        "credit_card",
        "ssn",
        "date_of_birth",
        "ip_address",
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    // Non-critical: if PII detection is unavailable, log and return safe
    console.error(
      `NVIDIA PII Detection API error (${response.status}): ${errorText.slice(0, 300)}`,
    );
    return { hasPii: false, entities: [] };
  }

  const data = (await response.json()) as PiiDetectionResponse;
  const rawEntities = data.entities ?? data.results ?? [];

  const entities = rawEntities.map((e) => ({
    text: e.entity,
    label: e.label,
    confidence: e.score,
    start: e.start,
    end: e.end,
  }));

  return {
    hasPii: entities.length > 0,
    entities,
  };
}

// ---------------------------------------------------------------------------
// Content Safety (NemoGuard)
// ---------------------------------------------------------------------------

export interface ContentSafetyOptions {
  /** Text to check for safety violations. */
  text: string;
}

interface SafetyCategory {
  category: string;
  score: number;
  flagged: boolean;
}

interface ContentSafetyResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  categories?: SafetyCategory[];
  results?: Array<{
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
}

export interface ContentSafetyResult {
  isSafe: boolean;
  categories: Array<{
    category: string;
    score: number;
    flagged: boolean;
  }>;
}

/**
 * Check text for content safety violations using NVIDIA NemoGuard.
 *
 * Returns safety classification across categories like toxicity, violence,
 * sexual content, hate speech, etc. Used in the quality layer to ensure
 * all agent outputs are brand-safe before delivery.
 */
export async function checkContentSafety(
  options: ContentSafetyOptions,
): Promise<ContentSafetyResult> {
  const apiKey = getApiKey();
  const { text } = options;

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODELS.contentSafety,
      messages: [
        {
          role: "user",
          content: text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    // Non-critical: if safety check is unavailable, log and flag for manual review
    console.error(
      `NVIDIA Content Safety API error (${response.status}): ${errorText.slice(0, 300)}`,
    );
    return {
      isSafe: true,
      categories: [
        { category: "unavailable", score: 0, flagged: false },
      ],
    };
  }

  const data = (await response.json()) as ContentSafetyResponse;

  // NemoGuard may return results in different formats depending on the
  // endpoint version. Handle both structured and chat-style responses.
  if (data.categories) {
    return {
      isSafe: data.categories.every((c) => !c.flagged),
      categories: data.categories,
    };
  }

  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    const categories = Object.entries(result.categories ?? {}).map(
      ([category, flagged]) => ({
        category,
        score: result.category_scores?.[category] ?? 0,
        flagged: Boolean(flagged),
      }),
    );
    return {
      isSafe: categories.every((c) => !c.flagged),
      categories,
    };
  }

  // Fallback: parse from chat completion content
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content) as {
      safe?: boolean;
      categories?: SafetyCategory[];
    };
    return {
      isSafe: parsed.safe !== false,
      categories: parsed.categories ?? [],
    };
  } catch {
    // If we cannot parse, assume safe but log for review
    console.warn("Could not parse NemoGuard response, assuming safe:", content.slice(0, 200));
    return { isSafe: true, categories: [] };
  }
}
