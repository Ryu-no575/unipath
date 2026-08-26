import type { ReactNode } from "react";

/**
 * The one empty-state shape for the app (AGENTS.md section 16): heading,
 * short body, one primary action. Never show a bare blank screen.
 */
export default function EmptyState({
  title,
  description,
  action,
  dashed = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl px-6 py-12 text-center ${
        dashed ? "border border-dashed border-zinc-300 bg-white" : "border border-zinc-200 bg-white"
      }`}
    >
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {description && <p className="max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
