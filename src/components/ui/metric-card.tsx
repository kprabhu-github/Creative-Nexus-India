import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  description?: string;
  trend?: string;
  className?: string;
}

export function MetricCard({ title, value, icon: Icon, description, trend, className }: MetricCardProps) {
  return (
    <div className={cn("bg-background-secondary rounded-[10px] p-3.5 dark:border dark:border-border", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground-tertiary uppercase tracking-wider">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-foreground-tertiary" strokeWidth={1.8} />}
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight mt-0.5">{value}</div>
      {(description || trend) && (
        <div className="text-xs font-medium mt-0.5">
          {trend && <span className="text-success">{trend}</span>}
          {description && !trend && <span className="text-foreground-tertiary">{description}</span>}
        </div>
      )}
    </div>
  );
}
