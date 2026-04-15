import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "accent" | "success" | "warning";
  className?: string;
}

export function ProgressBar({ value, max = 100, color = "accent", className }: ProgressBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  const colorMap = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
  };

  return (
    <div className={cn("h-1 bg-divider rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", colorMap[color])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
