import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  action,
}: {
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
      {action}
    </div>
  );
}
