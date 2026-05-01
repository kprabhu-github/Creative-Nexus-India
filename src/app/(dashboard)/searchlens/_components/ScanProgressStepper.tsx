"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GlowCard } from "./GlowCard";

interface ScanProgressStepperProps {
  platforms: string[];
  currentIdx: number;
  promptCount: number;
  etaSeconds: number;
}

/**
 * Replaces the old <ScanningBanner>: shows a vertical list of platforms with
 * per-step state (done / current / pending). The parent advances `currentIdx`
 * to drive the visual; the underlying scan API call may still be parallel —
 * this component is purely UX feedback.
 */
export function ScanProgressStepper({
  platforms,
  currentIdx,
  promptCount,
  etaSeconds,
}: ScanProgressStepperProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, etaSeconds - elapsed);
  const totalSteps = platforms.length || 1;
  const overallPct = Math.min(
    98,
    ((Math.min(currentIdx, totalSteps - 1) + (remaining === 0 ? 1 : 0.5)) / totalSteps) * 100,
  );

  return (
    <GlowCard glow className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-foreground">
            Scanning {promptCount} prompt{promptCount === 1 ? "" : "s"} across {totalSteps} AI platforms
          </span>
        </div>
        <span className="text-xs text-foreground-tertiary">
          ~{remaining}s remaining
        </span>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-1000 ease-linear"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      <ol className="space-y-2">
        {platforms.map((name, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li
              key={name}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                active && "bg-accent/5",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  done && "border-success bg-success/15 text-success",
                  active && "border-accent bg-accent/10 text-accent",
                  !done && !active && "border-divider text-foreground-tertiary",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                )}
              </span>
              <span
                className={cn(
                  "text-[13px]",
                  done && "text-foreground-secondary line-through decoration-foreground-tertiary/40",
                  active && "font-medium text-foreground",
                  !done && !active && "text-foreground-tertiary",
                )}
              >
                {active ? `Querying ${name}…` : `${name}`}
              </span>
            </li>
          );
        })}
      </ol>
    </GlowCard>
  );
}
