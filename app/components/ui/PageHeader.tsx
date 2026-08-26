import type { ReactNode } from "react";

/**
 * The heading + subheading + primary/secondary action row repeated at the
 * top of every top-level page. One Primary CTA max (AGENTS.md section 13) --
 * `secondaryAction` renders visually quieter than `primaryAction`.
 */
export default function PageHeader({
  title,
  description,
  primaryAction,
  secondaryAction,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {eyebrow}
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex shrink-0 items-center gap-3">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
