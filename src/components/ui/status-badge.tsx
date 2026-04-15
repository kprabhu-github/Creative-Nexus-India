import { cn } from "@/lib/utils";

type StatusType = "success" | "warning" | "error" | "info" | "neutral";

const styles: Record<StatusType, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
  info: "bg-accent/10 text-accent",
  neutral: "bg-foreground-tertiary/10 text-foreground-tertiary",
};

export function StatusBadge({
  type,
  children,
  className,
}: {
  type: StatusType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", styles[type], className)}>
      {children}
    </span>
  );
}
