import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="w-12 h-12 bg-background-secondary rounded-2xl flex items-center justify-center mb-4 dark:border dark:border-border">
        <Icon className="w-6 h-6 text-foreground-tertiary" strokeWidth={1.5} />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-[13px] text-foreground-tertiary max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
