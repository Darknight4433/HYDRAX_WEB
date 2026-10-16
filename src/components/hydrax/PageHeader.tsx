import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-0.5 sm:mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
