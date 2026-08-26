"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { NotificationSummary } from "@/app/lib/data/notifications";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import NotificationBell from "@/app/components/notifications/NotificationBell";
import { CommunityIcon, ExploreIcon, HomeIcon, PlanIcon, ProfileIcon } from "./icons";

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: () => React.JSX.Element;
  active: boolean;
}

export default function NavShell({
  userEmail,
  unreadNotificationCount = 0,
  recentNotifications = [],
  children,
}: {
  userEmail: string | null;
  locale: AppLocale;
  unreadNotificationCount?: number;
  recentNotifications?: NotificationSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");

  const isHome = pathname.startsWith("/dashboard");
  const isExplore = pathname.startsWith("/explore") || pathname.startsWith("/universities");
  const isPlan =
    pathname.startsWith("/routes") ||
    pathname.startsWith("/applications") ||
    pathname.startsWith("/passport") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/plan");
  const isCommunity = pathname.startsWith("/community");
  const isProfile = pathname.startsWith("/profile");

  const items: NavItem[] = [
    { key: "home", href: "/dashboard", label: t("home"), icon: HomeIcon, active: isHome },
    { key: "explore", href: "/explore", label: t("explore"), icon: ExploreIcon, active: isExplore },
    ...(userEmail
      ? [{ key: "plan", href: "/plan", label: t("plan"), icon: PlanIcon, active: isPlan }]
      : []),
    {
      key: "community",
      href: "/community",
      label: t("community"),
      icon: CommunityIcon,
      active: isCommunity,
    },
    ...(userEmail
      ? [{ key: "profile", href: "/profile", label: t("profile"), icon: ProfileIcon, active: isProfile }]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-zinc-900">
            {t("brand")}
          </Link>

          <nav className="hidden items-center gap-1 sm:flex" aria-label={t("brand")}>
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <item.icon />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {userEmail && (
              <NotificationBell
                unreadCount={unreadNotificationCount}
                recentNotifications={recentNotifications}
              />
            )}
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            {!userEmail && (
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pb-10">
        {children}
      </main>

      <nav
        aria-label={t("brand")}
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-zinc-200 bg-white/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              item.active ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            <item.icon />
            {item.label}
          </Link>
        ))}
        {!userEmail && (
          <Link
            href="/login"
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-zinc-400"
          >
            {t("login")}
          </Link>
        )}
      </nav>
    </div>
  );
}
