"use client";

import { useState, useMemo } from "react";
import {
  Globe,
  Zap,
  Clock,
  Layers,
  Bot,
  CheckCircle,
  Search,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SKILLS_REGISTRY,
  SKILL_CATEGORIES,
  type SkillDefinition,
  type SkillCategory,
  getSkillStats,
} from "@/lib/skills/registry";

// ---------------------------------------------------------------------------
// Status filter type
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "active" | "ready" | "planned";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusDot: Record<SkillDefinition["status"], string> = {
  active: "bg-success",
  ready: "bg-warning",
  planned: "bg-foreground-tertiary/40",
};

const statusLabel: Record<SkillDefinition["status"], string> = {
  active: "Active",
  ready: "Ready",
  planned: "Planned",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");

  const stats = useMemo(() => getSkillStats(), []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: SKILLS_REGISTRY.length };
    for (const skill of SKILLS_REGISTRY) {
      counts[skill.category] = (counts[skill.category] || 0) + 1;
    }
    return counts;
  }, []);

  // Filtered skills
  const filtered = useMemo(() => {
    let result = SKILLS_REGISTRY;

    if (activeCategory !== "all") {
      result = result.filter((s) => s.category === activeCategory);
    }

    if (activeStatus !== "all") {
      result = result.filter((s) => s.status === activeStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          SKILL_CATEGORIES[s.category].label.toLowerCase().includes(q)
      );
    }

    return result;
  }, [activeCategory, activeStatus, search]);

  // Selected skill
  const selectedSkill = useMemo(
    () => SKILLS_REGISTRY.find((s) => s.slug === selectedSlug) ?? null,
    [selectedSlug]
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="AI Skills Engine"
        description="Marketing intelligence powering your AI agents"
      />

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <MetricCard
          title="Total Skills"
          value={String(stats.total)}
          icon={Globe}
          description="Marketing skills loaded"
        />
        <MetricCard
          title="Active"
          value={String(stats.active)}
          icon={Zap}
          description="Wired into agents"
        />
        <MetricCard
          title="Ready"
          value={String(stats.ready)}
          icon={Clock}
          description="Ready to wire"
        />
        <MetricCard
          title="Planned"
          value={String(stats.planned)}
          icon={Layers}
          description="Future skills"
        />
        <MetricCard
          title="Agents Powered"
          value={String(stats.agentCount)}
          icon={Bot}
          description="Unique agents using skills"
        />
      </div>

      {/* ── Split panel ── */}
      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* ── Left panel: skill list ── */}
        <div className="w-[300px] shrink-0 flex flex-col bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden">
          {/* Title */}
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-[13px] font-semibold text-foreground">
              Skills Engine
            </h2>
            <p className="text-[11px] text-foreground-tertiary mt-0.5">
              Marketing intelligence powering your AI agents
            </p>
          </div>

          {/* Category filter pills */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory("all")}
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors
                ${
                  activeCategory === "all"
                    ? "bg-foreground text-background"
                    : "bg-surface-hover text-foreground-secondary hover:bg-surface-active"
                }
              `}
            >
              All
              <span className="opacity-60">{categoryCounts["all"]}</span>
            </button>
            {(Object.keys(SKILL_CATEGORIES) as SkillCategory[]).map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors
                    ${
                      activeCategory === cat
                        ? "bg-foreground text-background"
                        : "bg-surface-hover text-foreground-secondary hover:bg-surface-active"
                    }
                  `}
                >
                  {SKILL_CATEGORIES[cat].label}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Status filter pills */}
          <div className="px-4 pb-3 flex gap-1.5">
            {(["all", "active", "ready", "planned"] as StatusFilter[]).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setActiveStatus(st)}
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors capitalize
                    ${
                      activeStatus === st
                        ? "bg-foreground text-background"
                        : "bg-surface-hover text-foreground-tertiary hover:bg-surface-active"
                    }
                  `}
                >
                  {st === "all" ? "All" : st}
                </button>
              )
            )}
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-tertiary" />
              <input
                type="text"
                placeholder="Search skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-md text-[13px] text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
          </div>

          {/* Skill list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-px">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-[12px] text-foreground-tertiary">
                  No skills found
                </p>
              </div>
            ) : (
              filtered.map((skill) => (
                <button
                  key={skill.slug}
                  onClick={() => setSelectedSlug(skill.slug)}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg transition-all
                    ${
                      selectedSlug === skill.slug
                        ? "bg-surface-active border-l-2 border-accent"
                        : "hover:bg-surface-hover border-l-2 border-transparent"
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-foreground truncate flex-1">
                      {skill.name}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SKILL_CATEGORIES[skill.category].color}`}
                    >
                      {SKILL_CATEGORIES[skill.category].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[skill.status]}`}
                    />
                    <span className="text-[11px] text-foreground-tertiary">
                      {skill.agents.length > 0
                        ? `${skill.agents.length} agent${skill.agents.length !== 1 ? "s" : ""}`
                        : "No agents yet"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: skill detail ── */}
        <div className="flex-1 bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden flex flex-col">
          {selectedSkill ? (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-[22px] font-bold text-foreground tracking-tight">
                    {selectedSkill.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SKILL_CATEGORIES[selectedSkill.category].color}`}
                  >
                    {SKILL_CATEGORIES[selectedSkill.category].label}
                  </span>
                  <StatusBadge
                    type={
                      selectedSkill.status === "active"
                        ? "success"
                        : selectedSkill.status === "ready"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {statusLabel[selectedSkill.status]}
                  </StatusBadge>
                </div>
                <p className="text-[13px] text-foreground-tertiary leading-relaxed max-w-2xl">
                  {selectedSkill.description}
                </p>
              </div>

              {/* Agents section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-foreground-tertiary" />
                  <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                    Powering {selectedSkill.agents.length} agent
                    {selectedSkill.agents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {selectedSkill.agents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSkill.agents.map((agent, idx) => (
                      <div
                        key={idx}
                        className="bg-background rounded-lg p-3 border border-border"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowRight className="w-3 h-3 text-accent shrink-0" />
                          <span className="text-[13px] font-semibold text-foreground">
                            {agent.agent}
                          </span>
                          <span className="text-[11px] text-foreground-tertiary">
                            &mdash; {agent.module}
                          </span>
                        </div>
                        <p className="text-[12px] text-foreground-secondary leading-relaxed pl-5">
                          {agent.usage}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-background rounded-lg p-4 border border-border text-center">
                    <Inbox className="w-5 h-5 text-foreground-tertiary/40 mx-auto mb-2" />
                    <p className="text-[12px] text-foreground-tertiary">
                      Not yet wired into any agent
                    </p>
                    <StatusBadge type="neutral" className="mt-2 text-[10px]">
                      Planned
                    </StatusBadge>
                  </div>
                )}
              </div>

              {/* Principles section */}
              {selectedSkill.principles.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-foreground-tertiary" />
                    <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
                      Core Principles
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {selectedSkill.principles.map((principle, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 py-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                        <span className="text-[13px] text-foreground-secondary leading-relaxed">
                          {principle}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source */}
              <div className="pt-4 border-t border-border">
                <p className="text-[11px] text-foreground-tertiary">
                  From Corey Haines Marketing Skills
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-10 h-10 text-foreground-tertiary/30 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-foreground-tertiary">
                  Select a skill to see how it powers your agents
                </p>
                <p className="text-[12px] text-foreground-tertiary/60 mt-1">
                  {stats.total} skills across{" "}
                  {Object.keys(SKILL_CATEGORIES).length} categories
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
