"use client";

import { cn } from "@/lib/utils";

interface SkeletonShimmerProps {
  className?: string;
}

/**
 * Generic shimmer loader card. Use as a placeholder block while content loads.
 * Pure CSS gradient + animation; no JS work.
 */
export function SkeletonShimmer({ className }: SkeletonShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[12px] border border-white/10 bg-white/5 dark:bg-white/[0.03]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className,
      )}
      style={{
        // inline keyframe fallback in case `shimmer` isn't in tailwind config
        animation: undefined,
      }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}
