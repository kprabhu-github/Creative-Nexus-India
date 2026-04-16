// Global AI Skills Registry
// Maps which marketing skills power which agents across the platform.
// This is the single source of truth for skill → agent wiring.

export interface SkillDefinition {
  slug: string;
  name: string;
  category: SkillCategory;
  description: string;
  agents: AgentMapping[];
  principles: string[];
  status: "active" | "ready" | "planned";
}

export interface AgentMapping {
  agent: string;
  module: string;
  usage: string;
}

export type SkillCategory = "copywriting" | "email" | "psychology" | "seo" | "content" | "cro" | "paid-media" | "strategy" | "analytics";

export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; color: string }> = {
  copywriting: { label: "Copywriting", color: "text-accent bg-accent/10" },
  email: { label: "Email", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20" },
  psychology: { label: "Psychology", color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20" },
  seo: { label: "SEO", color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20" },
  content: { label: "Content", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20" },
  cro: { label: "CRO", color: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20" },
  "paid-media": { label: "Paid Media", color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20" },
  strategy: { label: "Strategy", color: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20" },
  analytics: { label: "Analytics", color: "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/20" },
};

export const SKILLS_REGISTRY: SkillDefinition[] = [
  // ── COPYWRITING ──
  {
    slug: "copywriting",
    name: "Copywriting",
    category: "copywriting",
    description: "Conversion copywriting frameworks: clarity over cleverness, benefits over features, specificity over vagueness.",
    agents: [
      { agent: "Email Drafting Agent", module: "Leads", usage: "Writes acknowledgement + follow-up emails using copywriting principles" },
      { agent: "Signal Brief Agent", module: "Signal Engine", usage: "Generates brand briefs with compelling messaging frameworks" },
    ],
    principles: [
      "Clarity over cleverness — if you must choose, choose clear",
      "Benefits over features — what it means for them, not what it does",
      "Specificity over vagueness — '4 hours to 15 minutes' beats 'save time'",
      "Customer language — mirror how they speak, not industry jargon",
      "One idea per section — each paragraph advances one point",
    ],
    status: "active",
  },
  {
    slug: "copy-editing",
    name: "Copy Editing",
    category: "copywriting",
    description: "7-sweep editing framework: clarity, voice, so-what, proof, specificity, emotion, zero-risk.",
    agents: [
      { agent: "Email Drafting Agent", module: "Leads", usage: "Runs 7-sweep mental editing pass on every email before output" },
    ],
    principles: [
      "Sweep 1 CLARITY: Instantly understandable, no jargon",
      "Sweep 2 VOICE: Consistent tone, no corporate shifts",
      "Sweep 3 SO WHAT: Every claim answers 'why should I care?'",
      "Sweep 4 PROVE IT: No unearned superlatives",
      "Sweep 5 SPECIFICITY: Numbers, timeframes, examples",
      "Sweep 6 EMOTION: Paint the before/after",
      "Sweep 7 ZERO RISK: Remove every barrier to action",
    ],
    status: "active",
  },
  // ── EMAIL ──
  {
    slug: "email-sequence",
    name: "Email Sequence",
    category: "email",
    description: "Email automation patterns: one email one job, value before ask, Hook→Context→Value→CTA structure.",
    agents: [
      { agent: "Email Drafting Agent", module: "Leads", usage: "Structures every email with Hook→Context→Value→CTA" },
      { agent: "Follow-up Processor", module: "Leads", usage: "Schedules 4-step sequence with escalating CTA patterns" },
    ],
    principles: [
      "One email = one job, one primary CTA",
      "Value before ask — lead with usefulness, earn the right to sell",
      "Structure: Hook → Context → Value → CTA",
      "Subject lines: Clear > Clever, 40-60 chars",
      "Email length: 150-300 words max for outreach",
    ],
    status: "active",
  },
  // ── PSYCHOLOGY ──
  {
    slug: "marketing-psychology",
    name: "Marketing Psychology",
    category: "psychology",
    description: "70+ mental models: reciprocity, loss aversion, social proof, anchoring, zero-risk framing.",
    agents: [
      { agent: "Email Drafting Agent", module: "Leads", usage: "Applies reciprocity, loss aversion, pratfall effect per follow-up step" },
      { agent: "Lead Qualification Agent", module: "Leads", usage: "Understands buyer signals and intent quality" },
      { agent: "GTM ICP Agent", module: "GTM Engine", usage: "Scores ICP fit using Jobs-to-be-Done and buyer psychology" },
    ],
    principles: [
      "Reciprocity — give value first, they feel obligated to respond",
      "Loss aversion — frame what they'll miss, not just what they'll gain",
      "Social proof — numbers and specifics create confidence",
      "Zero risk — 'no commitment, just a quick chat' removes friction",
      "Peak-end rule — end every email warm with an easy CTA",
      "Pratfall effect — small honest admissions build trust",
    ],
    status: "active",
  },
  // ── SEO ──
  {
    slug: "seo-audit",
    name: "SEO Audit",
    category: "seo",
    description: "Technical SEO, on-page optimization, content gaps, AI-readiness signals.",
    agents: [
      { agent: "SearchLens Scanner", module: "AI SearchLens", usage: "Runs SEO health checks during AI visibility scans" },
    ],
    principles: [
      "Technical: speed, mobile, crawlability, indexation, structured data",
      "On-page: titles, metas, H1s, content quality, internal links",
      "Off-page: backlink profile, domain authority, referring domains",
      "AI-readiness: schema markup, entity optimization, citation signals",
    ],
    status: "ready",
  },
  {
    slug: "schema-markup",
    name: "Schema Markup",
    category: "seo",
    description: "Structured data implementation for rich snippets and AI citation eligibility.",
    agents: [
      { agent: "SearchLens Scanner", module: "AI SearchLens", usage: "Checks structured data presence in AI visibility scans" },
    ],
    principles: [
      "Organization, LocalBusiness, FAQ, HowTo schema types",
      "JSON-LD format preferred over microdata",
      "Test with Google Rich Results validator",
    ],
    status: "ready",
  },
  {
    slug: "programmatic-seo",
    name: "Programmatic SEO",
    category: "seo",
    description: "Building pages at scale to target long-tail keywords systematically.",
    agents: [
      { agent: "Signal Content Agent", module: "Signal Engine", usage: "Generates content briefs targeting keyword clusters" },
    ],
    principles: [
      "Template + data = scalable pages",
      "Target long-tail keyword clusters",
      "Unique value on each page — not just variable swaps",
    ],
    status: "ready",
  },
  // ── CONTENT ──
  {
    slug: "content-strategy",
    name: "Content Strategy",
    category: "content",
    description: "Audience-first content planning: pain points, buyer journey mapping, distribution > creation.",
    agents: [
      { agent: "Signal Brief Agent", module: "Signal Engine", usage: "Maps content to buyer journey stages" },
      { agent: "Social Intelligence Agent", module: "Social", usage: "Analyzes content gaps in competitor landscape" },
    ],
    principles: [
      "Start with audience pain points, not product features",
      "Map content to: Awareness → Consideration → Decision",
      "Distribution > creation: 1 piece across 5 channels",
      "Competitor gap: what are they NOT covering?",
    ],
    status: "ready",
  },
  {
    slug: "social-content",
    name: "Social Content",
    category: "content",
    description: "Platform-specific social media content creation and distribution.",
    agents: [
      { agent: "Social Intelligence Agent", module: "Social", usage: "Generates platform-optimized social content recommendations" },
    ],
    principles: [
      "Each platform has its own language and format",
      "Hooks in first 3 seconds for video, first line for text",
      "Engage, don't broadcast — conversations > announcements",
    ],
    status: "ready",
  },
  // ── CRO ──
  {
    slug: "page-cro",
    name: "Page CRO",
    category: "cro",
    description: "Landing page conversion optimization: layout, copy, trust signals, CTAs.",
    agents: [],
    principles: [
      "Clear value prop above the fold",
      "Social proof near CTAs",
      "One primary action per page",
      "Reduce form fields to essentials",
    ],
    status: "planned",
  },
  {
    slug: "form-cro",
    name: "Form CRO",
    category: "cro",
    description: "Form optimization for higher completion rates.",
    agents: [],
    principles: [
      "Fewer fields = higher completion",
      "Progress indicators for multi-step",
      "Smart defaults reduce effort",
    ],
    status: "planned",
  },
  {
    slug: "popup-cro",
    name: "Popup CRO",
    category: "cro",
    description: "Exit-intent and timed popup optimization.",
    agents: [],
    principles: [
      "Exit-intent beats time-based for most sites",
      "One clear offer per popup",
      "Easy close — don't trap users",
    ],
    status: "planned",
  },
  {
    slug: "signup-flow-cro",
    name: "Signup Flow CRO",
    category: "cro",
    description: "Signup and registration flow optimization.",
    agents: [],
    principles: ["Reduce steps to minimum", "Social login options", "Show value before asking for info"],
    status: "planned",
  },
  {
    slug: "onboarding-cro",
    name: "Onboarding CRO",
    category: "cro",
    description: "User onboarding flow optimization for activation.",
    agents: [],
    principles: ["Get to aha moment fast", "Progressive disclosure", "Celebrate milestones"],
    status: "planned",
  },
  {
    slug: "paywall-upgrade-cro",
    name: "Paywall Upgrade CRO",
    category: "cro",
    description: "Freemium to paid conversion optimization.",
    agents: [],
    principles: ["Show value of upgrade at moment of need", "Gentle nudges, not hard gates", "Trial with full access"],
    status: "planned",
  },
  // ── PAID MEDIA ──
  {
    slug: "paid-ads",
    name: "Paid Ads",
    category: "paid-media",
    description: "Campaign strategy, ad creation, audience targeting, ROAS optimization.",
    agents: [
      { agent: "GTM Campaign Agent", module: "GTM Engine", usage: "Generates ad copy and targeting recommendations" },
    ],
    principles: [
      "Match ad message to landing page (scent trail)",
      "One audience, one message, one CTA per ad group",
      "Test creative before scaling budget",
      "80% proven channels, 20% experimental",
    ],
    status: "ready",
  },
  // ── STRATEGY ──
  {
    slug: "pricing-strategy",
    name: "Pricing Strategy",
    category: "strategy",
    description: "Pricing models, anchoring, Good-Better-Best tiering.",
    agents: [
      { agent: "GTM ICP Agent", module: "GTM Engine", usage: "Informs pricing recommendations in ICP analysis" },
    ],
    principles: [
      "Anchor with higher price first",
      "Three tiers: Good-Better-Best",
      "Frame in favorable mental accounts ('$3/day')",
    ],
    status: "ready",
  },
  {
    slug: "launch-strategy",
    name: "Launch Strategy",
    category: "strategy",
    description: "Product and campaign launch playbooks.",
    agents: [],
    principles: ["Build anticipation before launch", "Seed to early adopters first", "Plan the post-launch as much as the launch"],
    status: "planned",
  },
  {
    slug: "marketing-ideas",
    name: "Marketing Ideas",
    category: "strategy",
    description: "Creative marketing idea generation frameworks.",
    agents: [
      { agent: "Signal Brief Agent", module: "Signal Engine", usage: "Generates creative campaign ideas for brand briefs" },
    ],
    principles: ["Start with customer problems, not product features", "Steal frameworks, not ideas", "Test cheaply before scaling"],
    status: "ready",
  },
  {
    slug: "competitor-alternatives",
    name: "Competitor Alternatives",
    category: "strategy",
    description: "Competitor analysis and alternative positioning pages.",
    agents: [
      { agent: "SearchLens Scanner", module: "AI SearchLens", usage: "Competitive landscape analysis in AI visibility reports" },
      { agent: "Signal Brief Agent", module: "Signal Engine", usage: "Competitor gap analysis in brand briefs" },
    ],
    principles: ["Map competitor strengths and weaknesses", "Find gaps they're not covering", "Position on your unique strength"],
    status: "ready",
  },
  {
    slug: "referral-program",
    name: "Referral Program",
    category: "strategy",
    description: "Referral and affiliate program design.",
    agents: [],
    principles: ["Both sides must benefit", "Make sharing frictionless", "Track and reward quickly"],
    status: "planned",
  },
  {
    slug: "free-tool-strategy",
    name: "Free Tool Strategy",
    category: "strategy",
    description: "Building free tools for lead generation and SEO.",
    agents: [],
    principles: ["Solve one small problem completely", "Capture emails naturally", "Tool should demo your core value prop"],
    status: "planned",
  },
  {
    slug: "product-marketing-context",
    name: "Product Marketing Context",
    category: "strategy",
    description: "Central product/market context document for all agents.",
    agents: [
      { agent: "All Agents", module: "Global", usage: "Creative Nexus brand, services, ICP, and positioning context" },
    ],
    principles: ["Single source of truth for brand context", "Updated when positioning changes", "Every agent reads this first"],
    status: "active",
  },
  // ── ANALYTICS ──
  {
    slug: "ab-test-setup",
    name: "A/B Test Setup",
    category: "analytics",
    description: "Experiment design, sample size calculation, statistical significance.",
    agents: [],
    principles: ["One variable per test", "Calculate sample size before starting", "Run to significance, not convenience"],
    status: "planned",
  },
  {
    slug: "analytics-tracking",
    name: "Analytics Tracking",
    category: "analytics",
    description: "GA4, GTM, event tracking, and conversion measurement.",
    agents: [],
    principles: ["Track actions, not just pageviews", "Name events consistently", "Connect tracking to business outcomes"],
    status: "planned",
  },
];

// ── Helpers ──

export function getSkillsByAgent(agentName: string): SkillDefinition[] {
  return SKILLS_REGISTRY.filter((s) =>
    s.agents.some((a) => a.agent === agentName),
  );
}

export function getSkillsByModule(moduleName: string): SkillDefinition[] {
  return SKILLS_REGISTRY.filter((s) =>
    s.agents.some((a) => a.module === moduleName),
  );
}

export function getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return SKILLS_REGISTRY.filter((s) => s.category === category);
}

export function getActiveSkills(): SkillDefinition[] {
  return SKILLS_REGISTRY.filter((s) => s.status === "active");
}

export function getSkillStats() {
  const total = SKILLS_REGISTRY.length;
  const active = SKILLS_REGISTRY.filter((s) => s.status === "active").length;
  const ready = SKILLS_REGISTRY.filter((s) => s.status === "ready").length;
  const planned = SKILLS_REGISTRY.filter((s) => s.status === "planned").length;
  const agentCount = new Set(
    SKILLS_REGISTRY.flatMap((s) => s.agents.map((a) => a.agent)),
  ).size;
  return { total, active, ready, planned, agentCount };
}
