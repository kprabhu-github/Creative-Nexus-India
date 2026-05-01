"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TOCSection {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface SectionTOCProps {
  sections: TOCSection[];
  /**
   * Optional controlled active id. When omitted, the component derives the
   * active section from an IntersectionObserver watching each section.
   */
  activeId?: string;
  className?: string;
}

/**
 * Sticky vertical TOC that hops the reader between long-form sections.
 * Hidden below md: (TOC adds noise on small screens).
 *
 * Sections must have matching `id` attributes on their root in the page.
 * Smooth scrolling is handled programmatically via scrollIntoView so we
 * don't need to bake `scroll-behavior: smooth` into a parent.
 */
export function SectionTOC({ sections, activeId, className }: SectionTOCProps) {
  const [observedId, setObservedId] = useState<string | undefined>(sections[0]?.id);
  const ratiosRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (activeId !== undefined) return; // controlled — skip observer
    if (typeof window === "undefined" || sections.length === 0) return;

    const ratios = ratiosRef.current;
    sections.forEach((s) => ratios.set(s.id, 0));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.intersectionRatio);
        });
        // Pick the section with the highest current ratio above 0.
        let best: { id: string; ratio: number } | null = null;
        ratios.forEach((ratio, id) => {
          if (ratio > 0 && (!best || ratio > best.ratio)) {
            best = { id, ratio };
          }
        });
        if (best) setObservedId((best as { id: string; ratio: number }).id);
      },
      { rootMargin: "-80px 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections, activeId]);

  const currentId = activeId ?? observedId;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Update hash without forcing a jump
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <nav
      aria-label="On this page"
      className={cn(
        "hidden md:block sticky top-20 self-start w-[200px] shrink-0",
        className,
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-foreground-tertiary px-2 mb-2">
        On this page
      </div>
      <ul className="flex flex-col gap-0.5">
        {sections.map((s) => {
          const Icon = s.icon;
          const active = s.id === currentId;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors",
                  active
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-foreground-secondary hover:text-foreground hover:bg-foreground/[0.04]",
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />}
                <span className="truncate">{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
