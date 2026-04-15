"use client";

import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div className={cn("flex gap-px bg-divider rounded-[7px] p-px", className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            value === option
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground-tertiary hover:text-foreground-secondary"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
