// ---------------------------------------------------------------------------
// POST /api/ai-lab/chat — Send a message to an AI Lab agent
// ---------------------------------------------------------------------------
// Creates or continues an agent chat session. Fetches the agent template,
// builds context from recent message history, calls Claude, persists the
// conversation, and returns the assistant response.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/anthropic";
import type { ClaudeModelTier } from "@/lib/anthropic";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ChatInputSchema = z.object({
  agentTemplateId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  message: z.string().min(1).max(50000),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AgentTemplate {
  id: string;
  code: string;
  name: string;
  system_prompt: string;
  model_tier: string;
}

interface AgentSession {
  id: string;
  messages: ChatMessage[];
  total_tokens: number;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = ChatInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { agentTemplateId, sessionId, message } = parsed.data;
    const supabase = createAdminClient();

    // ----- 1. Fetch agent template -----

    const { data: template, error: templateError } = await supabase
      .from("ais_agent_templates")
      .select("id, code, name, system_prompt, model_tier")
      .eq("id", agentTemplateId)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: "Agent template not found or inactive" },
        { status: 404 },
      );
    }

    const agentTemplate = template as AgentTemplate;

    // ----- 2. Create or fetch session -----

    let session: AgentSession;

    if (sessionId) {
      const { data: existingSession, error: sessionError } = await supabase
        .from("ais_agent_sessions")
        .select("id, messages, total_tokens")
        .eq("id", sessionId)
        .single();

      if (sessionError || !existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      }

      session = existingSession as AgentSession;
    } else {
      // Create new session
      const { data: newSession, error: createError } = await supabase
        .from("ais_agent_sessions")
        .insert({
          agent_template_id: agentTemplateId,
          title: message.slice(0, 100),
          messages: [],
          total_tokens: 0,
        })
        .select("id, messages, total_tokens")
        .single();

      if (createError || !newSession) {
        return NextResponse.json(
          { error: `Failed to create session: ${createError?.message ?? "unknown"}` },
          { status: 500 },
        );
      }

      session = newSession as AgentSession;
    }

    // ----- 3. Build context from message history (last 20 messages) -----

    const existingMessages = (session.messages ?? []) as ChatMessage[];
    const recentMessages = existingMessages.slice(-20);

    // Build a single context string from conversation history
    let contextBlock = "";
    if (recentMessages.length > 0) {
      contextBlock = recentMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      contextBlock = `<conversation_history>\n${contextBlock}\n</conversation_history>\n\nUser: ${message}`;
    } else {
      contextBlock = message;
    }

    // ----- 4. Call Claude -----

    const tier = (agentTemplate.model_tier ?? "execution") as ClaudeModelTier;

    const response = await callClaude({
      tier,
      systemPrompt: agentTemplate.system_prompt,
      userMessage: contextBlock,
      maxTokens: 4096,
      temperature: 0.5,
    });

    // ----- 5. Append messages to session -----

    const now = new Date().toISOString();
    const userMsg: ChatMessage = { role: "user", content: message, timestamp: now };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: response.text,
      timestamp: now,
    };

    const updatedMessages = [...existingMessages, userMsg, assistantMsg];
    const updatedTokens =
      (session.total_tokens ?? 0) +
      response.usage.inputTokens +
      response.usage.outputTokens;

    // ----- 6. Update session -----

    const { error: updateError } = await supabase
      .from("ais_agent_sessions")
      .update({
        messages: updatedMessages,
        total_tokens: updatedTokens,
        updated_at: now,
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("Failed to update session:", updateError.message);
    }

    // ----- 7. Update template usage_count and last_used_at -----

    const { error: templateUpdateError } = await supabase.rpc(
      "increment_agent_usage",
      { template_id: agentTemplateId },
    );

    // Fallback: if RPC doesn't exist, do a manual update
    if (templateUpdateError) {
      await supabase
        .from("ais_agent_templates")
        .update({ last_used_at: now })
        .eq("id", agentTemplateId);
    }

    // ----- 8. Return response -----

    return NextResponse.json({
      data: {
        sessionId: session.id,
        response: response.text,
        usage: {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/ai-lab/chat error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
