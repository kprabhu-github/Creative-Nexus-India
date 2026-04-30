"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import {
  BrainCircuit,
  PenTool,
  Search,
  BarChart3,
  Mail,
  Globe,
  Share2,
  FileText,
  Target,
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  Bot,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  system_prompt: string;
  model_tier: string;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Icon registry — maps icon string names to Lucide components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  PenTool,
  Search,
  BarChart3,
  Mail,
  Globe,
  Share2,
  FileText,
  Target,
  Bot,
  BrainCircuit,
  Sparkles,
  MessageSquare,
};

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Bot;
}

// ---------------------------------------------------------------------------
// Fallback agent data (shown when API is unavailable / DB not seeded)
// ---------------------------------------------------------------------------

const FALLBACK_AGENTS: AgentTemplate[] = [
  {
    id: "fallback-1",
    code: "AIS_01",
    name: "Content Strategist",
    description:
      "Develops content strategies, editorial calendars, and topic clusters tailored to your brand voice and audience.",
    category: "content",
    icon: "PenTool",
    system_prompt: "",
    model_tier: "strategy",
    usage_count: 142,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-2",
    code: "AIS_02",
    name: "Deep Research Agent",
    description:
      "Conducts thorough market research, competitive analysis, and industry trend reports with cited sources.",
    category: "research",
    icon: "Search",
    system_prompt: "",
    model_tier: "research",
    usage_count: 118,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-3",
    code: "AIS_03",
    name: "Data & BI Analyst",
    description:
      "Analyses datasets, generates insights, builds dashboards narratives, and produces executive-ready reports.",
    category: "data",
    icon: "BarChart3",
    system_prompt: "",
    model_tier: "strategy",
    usage_count: 97,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-4",
    code: "AIS_04",
    name: "Email Manager",
    description:
      "Drafts email sequences, subject lines, and campaign flows optimised for open rates and conversions.",
    category: "assistant",
    icon: "Mail",
    system_prompt: "",
    model_tier: "execution",
    usage_count: 85,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-5",
    code: "AIS_05",
    name: "SEO Specialist",
    description:
      "Keyword research, on-page optimisation, meta tag generation, and technical SEO audit recommendations.",
    category: "marketing",
    icon: "Globe",
    system_prompt: "",
    model_tier: "execution",
    usage_count: 73,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-6",
    code: "AIS_06",
    name: "Social Media Manager",
    description:
      "Creates platform-specific social content, hashtag strategies, and engagement-driving post calendars.",
    category: "content",
    icon: "Share2",
    system_prompt: "",
    model_tier: "execution",
    usage_count: 64,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-7",
    code: "AIS_07",
    name: "Proposal & Pitch Writer",
    description:
      "Generates persuasive proposals, pitch decks outlines, and client-facing presentations with strategic framing.",
    category: "marketing",
    icon: "FileText",
    system_prompt: "",
    model_tier: "strategy",
    usage_count: 51,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
  {
    id: "fallback-8",
    code: "AIS_08",
    name: "Competitor Intelligence",
    description:
      "Monitors competitor activity, analyses positioning, and identifies market gaps and strategic opportunities.",
    category: "research",
    icon: "Target",
    system_prompt: "",
    model_tier: "research",
    usage_count: 39,
    last_used_at: null,
    is_active: true,
    created_at: "",
  },
];

// ---------------------------------------------------------------------------
// Category filter
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "All",
  "Marketing",
  "Research",
  "Content",
  "Operations",
] as const;
type Category = (typeof CATEGORIES)[number];

function categoryBadgeType(category: string) {
  switch (category) {
    case "marketing":
      return "info" as const;
    case "research":
      return "warning" as const;
    case "content":
      return "success" as const;
    case "operations":
      return "neutral" as const;
    case "data":
      return "info" as const;
    case "assistant":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "strategy":
      return "Opus-tier";
    case "execution":
      return "Sonnet-tier";
    case "research":
      return "Haiku-tier";
    default:
      return tier;
  }
}

// ---------------------------------------------------------------------------
// Animated loading dots
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex items-center gap-1">
        <span
          className="w-2 h-2 rounded-full bg-foreground-tertiary animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-foreground-tertiary animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-foreground-tertiary animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AILabPage() {
  // --- Agent state ---
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<Category>("All");
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(
    null,
  );

  // --- Chat state ---
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Fetch agents on mount ---
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/xapi/ai-lab/agents");
        if (!res.ok) throw new Error("fetch failed");
        const json = (await res.json()) as { data?: AgentTemplate[] };
        const fetched = json.data ?? [];
        setAgents(fetched.length > 0 ? fetched : FALLBACK_AGENTS);
      } catch {
        setAgents(FALLBACK_AGENTS);
      } finally {
        setAgentsLoading(false);
      }
    }
    fetchAgents();
  }, []);

  // --- Auto-scroll on new messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // --- Filter agents by category ---
  const filteredAgents =
    categoryFilter === "All"
      ? agents
      : agents.filter(
          (a) => a.category.toLowerCase() === categoryFilter.toLowerCase(),
        );

  // --- Select an agent (starts fresh chat) ---
  const selectAgent = useCallback((agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setSessionId(null);
    setMessages([]);
    setInputValue("");
  }, []);

  // --- New chat for current agent ---
  const startNewChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setInputValue("");
    textareaRef.current?.focus();
  }, []);

  // --- Send message ---
  const sendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !selectedAgent || isSending) return;

    // Optimistically add user message
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/xapi/ai-lab/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentTemplateId: selectedAgent.id,
          sessionId,
          message: trimmed,
        }),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorJson.error ?? `HTTP ${res.status}`);
      }

      const json = (await res.json()) as {
        data: { sessionId: string; response: string };
      };

      // Set sessionId if this was a new session
      if (!sessionId) {
        setSessionId(json.data.sessionId);
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: json.data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Something went wrong";
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Error: ${errorText}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, selectedAgent, isSending, sessionId]);

  // --- Keyboard handling for textarea ---
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // --- Auto-resize textarea ---
  const handleTextareaInput = useCallback(
    (e: FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      target.style.height = "auto";
      target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
      setInputValue(target.value);
    },
    [],
  );

  // --- Mobile agent selector ---
  const handleMobileSelect = useCallback(
    (e: FormEvent<HTMLSelectElement>) => {
      const id = e.currentTarget.value;
      const agent = agents.find((a) => a.id === id);
      if (agent) selectAgent(agent);
    },
    [agents, selectAgent],
  );

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight flex items-center gap-2">
            <BrainCircuit
              className="w-6 h-6 text-accent"
              strokeWidth={1.8}
            />
            AI Lab
          </h1>
          <p className="text-[13px] text-foreground-tertiary mt-0.5">
            {agents.length} agents available — select one to start a
            conversation
          </p>
        </div>
      </div>

      {/* Mobile agent selector (visible on small screens) */}
      <div className="block lg:hidden mb-3">
        <select
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          value={selectedAgent?.id ?? ""}
          onChange={handleMobileSelect}
        >
          <option value="" disabled>
            Select an agent...
          </option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Split panel layout */}
      <div className="flex gap-4 h-[calc(100%-3.5rem)] lg:h-[calc(100%-3rem)]">
        {/* =============================================================== */}
        {/* LEFT PANEL — Agent List */}
        {/* =============================================================== */}
        <div className="hidden lg:flex flex-col w-[340px] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-foreground">
              Agents
            </span>
            <span className="text-[11px] font-medium text-foreground-tertiary">
              {filteredAgents.length} available
            </span>
          </div>

          {/* Category filter */}
          <div className="mb-3">
            <SegmentedControl
              options={[...CATEGORIES]}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v as Category)}
            />
          </div>

          {/* Agent cards */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 pb-16 relative">
            {agentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12 text-[13px] text-foreground-tertiary">
                No agents in this category
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const Icon = getIcon(agent.icon);
                const isActive = selectedAgent?.id === agent.id;

                return (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className={cn(
                      "w-full text-left rounded-[10px] p-3 transition-all duration-200 group",
                      isActive
                        ? "bg-accent/10 border border-accent/20 shadow-sm"
                        : "bg-background-secondary hover:bg-surface-hover border border-transparent dark:border-border dark:hover:border-foreground-tertiary/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors",
                          isActive
                            ? "bg-accent/20 text-accent"
                            : "bg-foreground/5 text-foreground-tertiary group-hover:text-foreground-secondary dark:bg-foreground/10",
                        )}
                      >
                        <Icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[13px] font-medium truncate",
                              isActive
                                ? "text-accent"
                                : "text-foreground",
                            )}
                          >
                            {agent.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge
                            type={categoryBadgeType(agent.category)}
                          >
                            {agent.category}
                          </StatusBadge>
                          <span className="text-[10px] text-foreground-tertiary">
                            {agent.usage_count} uses
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* Create custom agent button */}
            <button className="w-full rounded-[10px] p-3 border border-dashed border-foreground-tertiary/30 text-foreground-tertiary hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-2 mt-2">
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span className="text-[12px] font-medium">
                Create Custom Agent
              </span>
            </button>
          </div>
        </div>

        {/* =============================================================== */}
        {/* RIGHT PANEL — Chat */}
        {/* =============================================================== */}
        <div className="flex-1 flex flex-col min-w-0 bg-background-secondary rounded-[12px] border border-transparent dark:border-border overflow-hidden">
          {!selectedAgent ? (
            /* ---------- Empty state ---------- */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4 dark:bg-foreground/10">
                <MessageSquare
                  className="w-7 h-7 text-foreground-tertiary"
                  strokeWidth={1.5}
                />
              </div>
              <h2 className="text-[16px] font-semibold text-foreground mb-1">
                Select an agent to start
              </h2>
              <p className="text-[13px] text-foreground-tertiary max-w-sm">
                Choose an AI agent from the panel to begin a conversation.
                Each agent is specialised for a different task.
              </p>
            </div>
          ) : (
            <>
              {/* ---------- Agent header ---------- */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background/60 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[8px] bg-accent/10 flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = getIcon(selectedAgent.icon);
                      return (
                        <Icon
                          className="w-4 h-4 text-accent"
                          strokeWidth={1.8}
                        />
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-foreground truncate">
                        {selectedAgent.name}
                      </h3>
                      <StatusBadge type="info">
                        {tierLabel(selectedAgent.model_tier)}
                      </StatusBadge>
                      <StatusBadge
                        type={categoryBadgeType(selectedAgent.category)}
                      >
                        {selectedAgent.category}
                      </StatusBadge>
                    </div>
                    <p className="text-[11px] text-foreground-tertiary truncate">
                      {selectedAgent.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={startNewChat}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  New Chat
                </button>
              </div>

              {/* ---------- Messages area ---------- */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && !isSending && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Sparkles
                      className="w-8 h-8 text-foreground-tertiary/40 mb-3"
                      strokeWidth={1.5}
                    />
                    <p className="text-[13px] text-foreground-tertiary">
                      Start a conversation with{" "}
                      <span className="font-medium text-foreground-secondary">
                        {selectedAgent.name}
                      </span>
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={`${msg.role}-${i}`}
                    className={cn(
                      "flex",
                      msg.role === "user"
                        ? "justify-end"
                        : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed",
                        msg.role === "user"
                          ? "bg-accent text-white rounded-br-md"
                          : "bg-background text-foreground rounded-bl-md dark:bg-card",
                      )}
                    >
                      <pre className="whitespace-pre-wrap font-sans break-words">
                        {msg.content}
                      </pre>
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-background rounded-2xl rounded-bl-md dark:bg-card">
                      <LoadingDots />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ---------- Input area ---------- */}
              <div className="px-4 pb-4 pt-2 border-t border-divider bg-background/60 backdrop-blur-sm shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedAgent.name}...`}
                    rows={1}
                    disabled={isSending}
                    className={cn(
                      "flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-[13px] text-foreground",
                      "placeholder:text-foreground-tertiary transition-colors outline-none",
                      "focus:border-accent focus:ring-2 focus:ring-accent/20",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "max-h-40 dark:bg-card",
                    )}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className={cn(
                      "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                      inputValue.trim() && !isSending
                        ? "bg-accent text-white hover:opacity-90 shadow-sm"
                        : "bg-foreground/5 text-foreground-tertiary cursor-not-allowed dark:bg-foreground/10",
                    )}
                  >
                    {isSending ? (
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        strokeWidth={2}
                      />
                    ) : (
                      <Send className="w-4 h-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-foreground-tertiary mt-1.5 text-center">
                  Enter to send, Shift + Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
