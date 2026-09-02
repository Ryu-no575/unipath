import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export interface TabItem {
  key: string;
  label: ReactNode;
  href: string;
  active: boolean;
}

/** The one tab-strip look used for every section sub-navigation (University
 * Detail, Plan, Explore, Community filters). Server-renderable -- callers
 * resolve translations and pass plain items. */
export default function Tabs({ items }: { items: TabItem[] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 pb-2">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? "bg-primary/10 text-primary"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
