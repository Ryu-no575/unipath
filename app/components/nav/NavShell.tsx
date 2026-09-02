"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { NotificationSummary } from "@/app/lib/data/notifications";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import NotificationBell from "@/app/components/notifications/NotificationBell";
import { useKeyboardOpen } from "@/app/lib/platform/useKeyboardOpen";
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
  isAdmin = false,
  children,
}: {
  userEmail: string | null;
  locale: AppLocale;
  unreadNotificationCount?: number;
  recentNotifications?: NotificationSummary[];
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const keyboardOpen = useKeyboardOpen();

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
  const isAdminSection = pathname.startsWith("/admin");

  // Signed-in nav: Home, Explore, Plan, Community, Profile (task brief
  // section 7). A guest gets a deliberately minimal, marketing-style nav
  // instead -- no Home (it's /dashboard, which a guest can't use) and no
  // Plan/Profile (both entirely login-gated) -- so there's nothing here that
  // dead-ends into a login redirect.
  const items: NavItem[] = userEmail
    ? [
        { key: "home", href: "/dashboard", label: t("home"), icon: HomeIcon, active: isHome },
        { key: "explore", href: "/explore", label: t("explore"), icon: ExploreIcon, active: isExplore },
        { key: "plan", href: "/plan", label: t("plan"), icon: PlanIcon, active: isPlan },
        { key: "community", href: "/community", label: t("community"), icon: CommunityIcon, active: isCommunity },
        { key: "profile", href: "/profile", label: t("profile"), icon: ProfileIcon, active: isProfile },
      ]
    : [{ key: "explore", href: "/explore", label: t("explore"), icon: ExploreIcon, active: isExplore }];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <header
        className="sticky top-0 z-10 border-b border-zinc-200 glass-panel-light"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href={userEmail ? "/dashboard" : "/"} className="text-lg font-semibold tracking-tight text-navy-900">
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
                    ? "bg-primary/10 text-primary"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <item.icon />
                {item.label}
              </Link>
            ))}
            {!userEmail && (
              <Link
                href="/#how-it-works"
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {t("howItWorks")}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link
                href="/admin"
                aria-current={isAdminSection ? "page" : undefined}
                className={`hidden rounded-md px-3 py-2 text-sm font-medium transition-colors sm:block ${
                  isAdminSection
                    ? "bg-navy-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {t("admin")}
              </Link>
            )}
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
              <>
                <Link
                  href="/login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/explore"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-soft transition-colors hover:bg-primary-dark"
                >
                  {t("tryFree")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(6rem+var(--safe-bottom))] pt-8 sm:px-6 sm:pb-10"
      >
        {children}
      </main>

      <nav
        aria-label={t("brand")}
        aria-hidden={keyboardOpen}
        className={`fixed inset-x-0 bottom-0 z-10 flex border-t border-zinc-200 glass-panel-light transition-transform sm:hidden ${
          keyboardOpen ? "translate-y-full" : "translate-y-0"
        }`}
        style={{
          paddingBottom: "var(--safe-bottom)",
          paddingLeft: "var(--safe-left)",
          paddingRight: "var(--safe-right)",
        }}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              item.active ? "text-primary" : "text-zinc-400"
            }`}
          >
            <item.icon />
            {item.label}
          </Link>
        ))}
        {!userEmail && (
          <Link
            href="/login"
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium text-zinc-400"
          >
            {t("login")}
          </Link>
        )}
      </nav>
    </div>
  );
}
