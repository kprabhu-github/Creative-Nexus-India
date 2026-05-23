"use client";

import { Sparkles, Lightbulb } from "lucide-react";

interface Props {
  agentName: string;
  agentDescription: string;
  agentCategory: string;
  onPick: (prompt: string) => void;
}

// Generic category prompts shown beneath the per-agent ones so even custom
// agents that lack a starter set still feel populated.
const CATEGORY_PROMPTS: Record<string, string[]> = {
  marketing: [
    "Draft a 3-post campaign about our latest launch.",
    "Write a LinkedIn post pitching our service to CMOs.",
    "Suggest 5 hooks for a TikTok ad targeting Gen Z founders.",
  ],
  content: [
    "Write a 500-word SEO blog intro on AI for agencies.",
    "Generate 10 catchy blog titles about brand storytelling.",
    "Draft an email newsletter announcing a new feature.",
  ],
  research: [
    "Summarize the top 5 trends in AI agencies for 2026.",
    "Compare our pricing model with the top 3 competitors.",
    "Profile a target buyer persona for our new product.",
  ],
  operations: [
    "Draft an onboarding checklist for a new client.",
    "Outline an SOP for monthly performance reviews.",
    "Suggest workflow automations to save 5 hours a week.",
  ],
  assistant: [
    "Draft a follow-up email after a discovery call.",
    "Write a polite decline to a vendor pitch.",
    "Summarize this meeting into action items.",
  ],
  data: [
    "Suggest 5 KPIs to track campaign performance.",
    "Explain how to read this CSV's column structure.",
    "Build a weekly reporting template outline.",
  ],
};

// Per-agent prompts override the generic ones when the agent code matches.
// Keys are case-insensitive prefixes of agent.code or agent.name.
const AGENT_PROMPTS: Array<{ match: RegExp; prompts: string[] }> = [
  {
    match: /content\s*strateg/i,
    prompts: [
      "Draft a 500-word LinkedIn thought-leadership post on AI agencies.",
      "Plan a 30-day content calendar for our brand.",
      "Suggest 10 viral blog titles in the AI-for-creatives niche.",
      "Rewrite this paragraph in Creative Nexus brand voice: ...",
    ],
  },
  {
    match: /deep\s*research|research\s*agent/i,
    prompts: [
      "Profile our top 3 competitors and identify their weaknesses.",
      "Summarize the latest research on agentic AI workflows.",
      "Find market size + growth rate for AI-native agencies in India.",
      "Map the buyer journey for a CMO at a Series B SaaS company.",
    ],
  },
  {
    match: /data|bi\s*analyst/i,
    prompts: [
      "Outline 5 dashboards every agency CEO should track weekly.",
      "Suggest KPIs for measuring AI agent ROI.",
      "Explain how to interpret a conversion funnel with 4 stages.",
    ],
  },
  {
    match: /email\s*manager/i,
    prompts: [
      "Draft a cold outreach email to a prospective enterprise client.",
      "Write a 3-touch nurture sequence for warm leads.",
      "Compose a polite payment-overdue reminder.",
    ],
  },
  {
    match: /seo/i,
    prompts: [
      "Audit our homepage for top 5 SEO issues.",
      "Suggest 20 long-tail keywords for 'AI marketing agency'.",
      "Write meta title + description for our pricing page.",
    ],
  },
  {
    match: /social\s*media/i,
    prompts: [
      "Plan 7 days of Instagram posts around our brand pillars.",
      "Write a viral Twitter thread on AI agencies.",
      "Suggest 5 LinkedIn carousel topics for B2B SaaS founders.",
    ],
  },
];

export function StarterPrompts({
  agentName,
  agentDescription,
  agentCategory,
  onPick,
}: Props) {
  const agentMatch = AGENT_PROMPTS.find((p) => p.match.test(agentName));
  const list = agentMatch?.prompts
    ?? CATEGORY_PROMPTS[agentCategory.toLowerCase()]
    ?? CATEGORY_PROMPTS.assistant;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
        <Sparkles className="w-6 h-6 text-accent" strokeWidth={1.6} />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">
        Start a conversation with{" "}
        <span className="text-accent">{agentName}</span>
      </h3>
      <p className="text-[12px] text-foreground-tertiary max-w-sm mb-5">
        {agentDescription}
      </p>

      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-tertiary mb-2">
        <Lightbulb className="w-3 h-3" strokeWidth={2} />
        Try asking
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
        {list.slice(0, 4).map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="text-left px-3 py-2.5 rounded-xl border border-divider bg-background/40 hover:bg-accent/5 hover:border-accent/40 transition-colors text-[12.5px] text-foreground-secondary"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
