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
    <div className="mb-6 sm:mb-8 space-y-3.5">
      <div className="flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1.5">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 2xl:pt-0 2xl:justify-end 2xl:max-w-2xl">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
