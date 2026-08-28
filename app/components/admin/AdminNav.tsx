"use client";

import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

interface AdminNavProps {
  locale: AppLocale;
  heading: string;
  navDashboard: string;
  navUniversities: string;
  navPrograms: string;
  navSources: string;
  navChanges: string;
  navCommunity: string;
  navPriorities: string;
}

export default function AdminNav({
  heading,
  navDashboard,
  navUniversities,
  navPrograms,
  navSources,
  navChanges,
  navCommunity,
  navPriorities,
}: AdminNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: navDashboard },
    { href: "/admin/universities", label: navUniversities },
    { href: "/admin/priorities", label: navPriorities },
    { href: "/admin/programs", label: navPrograms },
    { href: "/admin/sources", label: navSources },
    { href: "/admin/changes", label: navChanges },
    { href: "/admin/community", label: navCommunity },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
          Admin
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{heading}</h1>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-zinc-200 pb-2" aria-label="Admin">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
