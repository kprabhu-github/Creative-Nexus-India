"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const options = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
    { value: "system", icon: Monitor },
  ] as const;

  return (
    <div className={cn("flex gap-px bg-divider rounded-[7px] p-px", className)}>
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "p-1.5 rounded-md transition-all",
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground-tertiary hover:text-foreground-secondary"
          )}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
