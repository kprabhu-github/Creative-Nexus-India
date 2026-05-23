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
  ArrowRight,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { MarkdownMessage } from "@/components/ai-lab/MarkdownMessage";
import { MessageActions } from "@/components/ai-lab/MessageActions";
import { StarterPrompts } from "@/components/ai-lab/StarterPrompts";
import { ChatActions } from "@/components/ai-lab/ChatActions";

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

// Compact one-letter tier tag for the agent card (O/S/H).
function tierAbbrev(tier: string): string {
  switch (tier) {
    case "strategy":
      return "O";
    case "execution":
      return "S";
    case "research":
      return "H";
    default:
      return "·";
  }
}

// Category colour tokens for the agent icon background + foreground.
// Uses arbitrary Tailwind values so a future palette swap touches one file.
function categoryColor(category: string): { bg: string; fg: string } {
  switch (category.toLowerCase()) {
    case "marketing":
      return { bg: "bg-blue-500/10", fg: "text-blue-500" };
    case "research":
      return { bg: "bg-amber-500/10", fg: "text-amber-500" };
    case "content":
      return { bg: "bg-emerald-500/10", fg: "text-emerald-500" };
    case "operations":
      return { bg: "bg-violet-500/10", fg: "text-violet-500" };
    case "data":
      return { bg: "bg-rose-500/10", fg: "text-rose-500" };
    case "assistant":
      return { bg: "bg-foreground/10", fg: "text-foreground-secondary" };
    default:
      return { bg: "bg-foreground/10", fg: "text-foreground-secondary" };
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // --- Filter agents by category then by search query ---
  const categoryFiltered =
    categoryFilter === "All"
      ? agents
      : agents.filter(
          (a) => a.category.toLowerCase() === categoryFilter.toLowerCase(),
        );

  const filteredAgents = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryFiltered;
    return categoryFiltered.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  })();

  // Counts per tab (always against full agent list, ignoring search).
  const categoryCounts: Record<Category, number> = {
    All: agents.length,
    Marketing: agents.filter((a) => a.category.toLowerCase() === "marketing")
      .length,
    Research: agents.filter((a) => a.category.toLowerCase() === "research")
      .length,
    Content: agents.filter((a) => a.category.toLowerCase() === "content")
      .length,
    Operations: agents.filter((a) => a.category.toLowerCase() === "operations")
      .length,
  };

  // Set of "Popular" agent ids = top 3 by usage_count, only when usage > 0.
  const popularIds = new Set(
    [...agents]
      .filter((a) => a.usage_count > 0)
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 3)
      .map((a) => a.id),
  );

  // ⌘K / Ctrl+K focuses the agent search.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // --- Send message (optional override lets starter prompts + regenerate
  //     bypass the input value) ---
  const sendMessage = useCallback(
    async (override?: string) => {
      const trimmed = (override ?? inputValue).trim();
      if (!trimmed || !selectedAgent || isSending) return;

      // Optimistically add user message
      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      if (!override) setInputValue("");
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
    },
    [inputValue, selectedAgent, isSending, sessionId],
  );

  // --- Regenerate last assistant response (drop it + re-send last user turn) ---
  const regenerate = useCallback(() => {
    if (isSending) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      // Drop trailing assistant messages so the regenerated one replaces them.
      const out = [...prev];
      while (out.length && out[out.length - 1].role === "assistant") out.pop();
      return out.slice(0, -1); // also drop the user msg, send() re-adds it
    });
    void sendMessage(lastUser.content);
  }, [messages, isSending, sendMessage]);

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
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-foreground">
              Agents
            </span>
            <span className="text-[11px] font-medium text-foreground-tertiary">
              {filteredAgents.length} of {agents.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-tertiary pointer-events-none"
              strokeWidth={1.8}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents… ⌘K"
              aria-label="Search agents"
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-input bg-background text-[12px] text-foreground placeholder:text-foreground-tertiary outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 transition-colors dark:bg-card"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded text-foreground-tertiary hover:text-foreground hover:bg-foreground/10"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Category tabs with counts + underline active state */}
          <div
            role="tablist"
            aria-label="Filter agents by category"
            className="flex items-center gap-0.5 border-b border-divider mb-2 overflow-x-auto"
          >
            {CATEGORIES.map((cat) => {
              const active = categoryFilter === cat;
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "relative px-2.5 py-1.5 text-[11.5px] whitespace-nowrap transition-colors",
                    active
                      ? "text-foreground font-semibold"
                      : "text-foreground-tertiary hover:text-foreground-secondary font-medium",
                  )}
                >
                  {cat}
                  <span
                    className={cn(
                      "ml-1 text-[10px]",
                      active
                        ? "text-accent"
                        : "text-foreground-tertiary/70",
                    )}
                  >
                    {count}
                  </span>
                  {active && (
                    <span className="absolute left-1.5 right-1.5 -bottom-px h-0.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Agent cards */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-16 relative">
            {agentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12 text-[12.5px] text-foreground-tertiary">
                {searchQuery
                  ? `No agents match "${searchQuery}"`
                  : "No agents in this category"}
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const Icon = getIcon(agent.icon);
                const isActive = selectedAgent?.id === agent.id;
                const colour = categoryColor(agent.category);
                const isPopular = popularIds.has(agent.id);

                return (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className={cn(
                      "w-full text-left rounded-[10px] px-2.5 py-2 transition-all duration-150 group relative",
                      isActive
                        ? "bg-accent/10 border border-accent/30 shadow-sm"
                        : "border border-transparent hover:bg-foreground/[0.04] hover:border-foreground/10 dark:hover:bg-foreground/[0.06]",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                          isActive
                            ? "bg-accent/20 text-accent"
                            : `${colour.bg} ${colour.fg}`,
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[12.5px] font-semibold truncate",
                              isActive ? "text-accent" : "text-foreground",
                            )}
                          >
                            {agent.name}
                          </span>
                          <span
                            className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-foreground/10 text-foreground-secondary"
                            title={tierLabel(agent.model_tier)}
                          >
                            {tierAbbrev(agent.model_tier)}
                          </span>
                          {isPopular && (
                            <Star
                              className="shrink-0 w-3 h-3 text-amber-500"
                              strokeWidth={2}
                              fill="currentColor"
                              aria-label="Popular agent"
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-foreground-tertiary mt-0.5 truncate leading-snug">
                          {agent.description}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold transition-opacity",
                          isActive
                            ? "text-accent opacity-100"
                            : "text-foreground-tertiary opacity-0 group-hover:opacity-100",
                        )}
                      >
                        {agent.usage_count > 0 && !isActive && (
                          <span className="opacity-60">{agent.usage_count}x</span>
                        )}
                        <ArrowRight
                          className="w-3.5 h-3.5"
                          strokeWidth={2}
                        />
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
                <div className="shrink-0 flex items-center gap-1">
                  <ChatActions
                    messages={messages}
                    agentName={selectedAgent.name}
                    onRegenerate={regenerate}
                    onClear={startNewChat}
                    disabled={isSending}
                  />
                  <span className="mx-1 h-4 w-px bg-divider" />
                  <button
                    onClick={startNewChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    New Chat
                  </button>
                </div>
              </div>

              {/* ---------- Messages area ---------- */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {messages.length === 0 && !isSending && (
                  <StarterPrompts
                    agentName={selectedAgent.name}
                    agentDescription={selectedAgent.description}
                    agentCategory={selectedAgent.category}
                    onPick={(p) => void sendMessage(p)}
                  />
                )}

                {messages.map((msg, i) => {
                  const isLastAssistant =
                    msg.role === "assistant" &&
                    i === messages.length - 1 &&
                    !isSending;
                  return (
                    <div
                      key={`${msg.role}-${i}`}
                      className={cn(
                        "flex",
                        msg.role === "user"
                          ? "justify-end"
                          : "justify-start",
                      )}
                    >
                      <div className={cn("max-w-[82%] min-w-0")}>
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5",
                            msg.role === "user"
                              ? "bg-accent text-white rounded-br-md"
                              : "bg-background text-foreground rounded-bl-md border border-divider dark:bg-card",
                          )}
                        >
                          <MarkdownMessage
                            content={msg.content}
                            variant={msg.role}
                          />
                        </div>
                        {msg.role === "assistant" && (
                          <MessageActions
                            content={msg.content}
                            agentName={selectedAgent.name}
                            onRegenerate={isLastAssistant ? regenerate : undefined}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-background rounded-2xl rounded-bl-md dark:bg-card border border-divider">
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
                    onClick={() => void sendMessage()}
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
