"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Skill {
  slug: string;
  name: string;
  displayName: string;
  description: string;
  content: string;
  category: string;
}

type CategoryFilter =
  | "All"
  | "CRO"
  | "SEO"
  | "Content"
  | "Paid Media"
  | "Email"
  | "Analytics"
  | "Strategy";

const CATEGORIES: CategoryFilter[] = [
  "All",
  "CRO",
  "SEO",
  "Content",
  "Paid Media",
  "Email",
  "Analytics",
  "Strategy",
];

// ---------------------------------------------------------------------------
// Category badge type mapping
// ---------------------------------------------------------------------------

type BadgeType = "success" | "warning" | "error" | "info" | "neutral";

const categoryBadgeType: Record<string, BadgeType> = {
  CRO: "success",
  SEO: "info",
  Content: "warning",
  "Paid Media": "error",
  Email: "neutral",
  Analytics: "info",
  Strategy: "neutral",
};

// ---------------------------------------------------------------------------
// Simple markdown-to-HTML converter
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks: ```lang ... ```
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_match, code: string) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre class="bg-surface-active rounded-lg p-4 overflow-x-auto text-[13px] leading-relaxed my-4"><code>${escaped}</code></pre>`;
  });

  // Split into blocks by double newlines
  const blocks = html.split(/\n\n+/);
  const processed: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    // Already processed code block
    if (block.startsWith("<pre")) {
      processed.push(block);
      continue;
    }

    // Headings
    if (block.startsWith("### ")) {
      const text = block.slice(4);
      processed.push(
        `<h4 class="text-[14px] font-semibold text-foreground mt-6 mb-2">${text}</h4>`
      );
      continue;
    }
    if (block.startsWith("## ")) {
      const text = block.slice(3);
      processed.push(
        `<h3 class="text-[16px] font-semibold text-foreground mt-8 mb-3">${text}</h3>`
      );
      continue;
    }
    if (block.startsWith("# ")) {
      const text = block.slice(2);
      processed.push(
        `<h2 class="text-[18px] font-bold text-foreground mt-8 mb-3">${text}</h2>`
      );
      continue;
    }

    // Unordered list
    const lines = block.split("\n");
    if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
      const items = lines
        .map((l) => {
          let text = l.trim().replace(/^[-*]\s+/, "");
          text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
          text = text.replace(/`(.*?)`/g, '<code class="bg-surface-active px-1.5 py-0.5 rounded text-[12px]">$1</code>');
          return `<li class="text-[13px] text-foreground-secondary leading-relaxed">${text}</li>`;
        })
        .join("");
      processed.push(`<ul class="list-disc list-inside space-y-1 my-3">${items}</ul>`);
      continue;
    }

    // Mixed block with headings + list items (multi-line block)
    if (lines.some((l) => /^[-*]\s/.test(l.trim())) || lines.some((l) => /^#{1,4}\s/.test(l.trim()))) {
      // Process each line individually
      const subItems: string[] = [];
      let listBuffer: string[] = [];

      const flushList = () => {
        if (listBuffer.length > 0) {
          const items = listBuffer
            .map((l) => {
              let text = l.trim().replace(/^[-*]\s+/, "");
              text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
              text = text.replace(/`(.*?)`/g, '<code class="bg-surface-active px-1.5 py-0.5 rounded text-[12px]">$1</code>');
              return `<li class="text-[13px] text-foreground-secondary leading-relaxed">${text}</li>`;
            })
            .join("");
          subItems.push(`<ul class="list-disc list-inside space-y-1 my-2">${items}</ul>`);
          listBuffer = [];
        }
      };

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (/^[-*]\s/.test(trimmedLine)) {
          listBuffer.push(trimmedLine);
        } else {
          flushList();
          if (trimmedLine.startsWith("### ")) {
            subItems.push(`<h4 class="text-[14px] font-semibold text-foreground mt-4 mb-2">${trimmedLine.slice(4)}</h4>`);
          } else if (trimmedLine.startsWith("## ")) {
            subItems.push(`<h3 class="text-[16px] font-semibold text-foreground mt-6 mb-3">${trimmedLine.slice(3)}</h3>`);
          } else if (trimmedLine.startsWith("# ")) {
            subItems.push(`<h2 class="text-[18px] font-bold text-foreground mt-6 mb-3">${trimmedLine.slice(2)}</h2>`);
          } else if (trimmedLine) {
            let text = trimmedLine;
            text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
            text = text.replace(/`(.*?)`/g, '<code class="bg-surface-active px-1.5 py-0.5 rounded text-[12px]">$1</code>');
            subItems.push(`<p class="text-[13px] text-foreground-secondary leading-relaxed my-1">${text}</p>`);
          }
        }
      }
      flushList();
      processed.push(subItems.join(""));
      continue;
    }

    // Paragraph: apply inline formatting
    let text = block.replace(/\n/g, " ");
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/`(.*?)`/g, '<code class="bg-surface-active px-1.5 py-0.5 rounded text-[12px]">$1</code>');
    processed.push(
      `<p class="text-[13px] text-foreground-secondary leading-relaxed my-3">${text}</p>`
    );
  }

  return processed.join("\n");
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");

  // Fetch skills
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/skills");
        const json = await res.json() as { data?: { skills: Skill[] } };
        if (json.data?.skills) {
          setSkills(json.data.skills);
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: skills.length };
    for (const skill of skills) {
      counts[skill.category] = (counts[skill.category] || 0) + 1;
    }
    return counts;
  }, [skills]);

  // Filtered skills
  const filtered = useMemo(() => {
    let result = skills;

    if (activeCategory !== "All") {
      result = result.filter((s) => s.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [skills, activeCategory, search]);

  // Selected skill
  const selectedSkill = useMemo(
    () => skills.find((s) => s.slug === selectedSlug) ?? null,
    [skills, selectedSlug]
  );

  // Rendered HTML for selected skill
  const renderedContent = useMemo(() => {
    if (!selectedSkill) return "";
    return markdownToHtml(selectedSkill.content);
  }, [selectedSkill]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-tertiary" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Skills Library"
        description={`${skills.length} marketing skills ready to deploy`}
      />

      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {/* ----- Left panel: skill list ----- */}
        <div className="w-[280px] shrink-0 flex flex-col bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden">
          {/* Title */}
          <div className="px-4 pt-4 pb-3">
            <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">
              Marketing Skills
            </span>
          </div>

          {/* Category filter pills */}
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              if (cat !== "All" && count === 0) return null;
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
                  {cat}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
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
                      {skill.displayName}
                    </span>
                    <StatusBadge
                      type={categoryBadgeType[skill.category] ?? "neutral"}
                      className="text-[10px] shrink-0"
                    >
                      {skill.category}
                    </StatusBadge>
                  </div>
                  <p className="text-[11px] text-foreground-tertiary leading-snug line-clamp-2">
                    {skill.description.slice(0, 60)}
                    {skill.description.length > 60 ? "..." : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ----- Right panel: skill detail ----- */}
        <div className="flex-1 bg-background-secondary rounded-[10px] dark:border dark:border-border overflow-hidden flex flex-col">
          {selectedSkill ? (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-[22px] font-bold text-foreground tracking-tight">
                    {selectedSkill.displayName}
                  </h1>
                  <StatusBadge
                    type={categoryBadgeType[selectedSkill.category] ?? "neutral"}
                  >
                    {selectedSkill.category}
                  </StatusBadge>
                </div>
                <p className="text-[13px] text-foreground-tertiary leading-relaxed max-w-2xl">
                  {selectedSkill.description}
                </p>
              </div>

              {/* Rendered markdown content */}
              <div
                className="prose-custom max-w-3xl"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="w-10 h-10 text-foreground-tertiary/30 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-foreground-tertiary">
                  Select a skill to view details
                </p>
                <p className="text-[12px] text-foreground-tertiary/60 mt-1">
                  {skills.length} skills available across{" "}
                  {Object.keys(categoryCounts).length - 1} categories
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
