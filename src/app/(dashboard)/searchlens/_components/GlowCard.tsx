"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

/**
 * Frosted-glass card primitive.
 * Subtle translucent background + backdrop blur + soft border.
 * When `glow` is true, adds a coral-tinted outer glow for emphasis.
 */
export function GlowCard({ children, className = "", glow = false }: GlowCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-[12px] border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all dark:bg-white/[0.03]",
        glow && "shadow-[0_0_40px_rgba(255,107,90,0.15)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
