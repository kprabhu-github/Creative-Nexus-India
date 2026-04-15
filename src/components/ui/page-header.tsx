import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-[22px] font-bold text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-[13px] text-foreground-tertiary mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
