"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { logOutAction } from "@/app/lib/actions/auth";
import type { NotificationSummary } from "@/app/lib/data/notifications";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./notifications/NotificationBell";

export default function SiteHeader({
  userEmail,
  locale,
  unreadNotificationCount = 0,
  recentNotifications = [],
}: {
  userEmail: string | null;
  locale: AppLocale;
  unreadNotificationCount?: number;
  recentNotifications?: NotificationSummary[];
}) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");

  const isExplore = pathname.startsWith("/explore");
  const isApplications = pathname.startsWith("/applications");
  const isPassport = pathname.startsWith("/passport");
  const isRoutes = pathname.startsWith("/routes");
  const isCalendar = pathname.startsWith("/calendar");
  const isProfile = pathname.startsWith("/profile");
  const isDashboard = pathname.startsWith("/dashboard");
  const isCommunity = pathname.startsWith("/community") || pathname.startsWith("/universities");

  const navLinkClass = (active: boolean) =>
    `rounded-md px-3 py-2 transition-colors ${
      active ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-zinc-900">
          {t("brand")}
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Link
            href="/dashboard"
            aria-current={isDashboard ? "page" : undefined}
            className={navLinkClass(isDashboard)}
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/applications"
            aria-current={isApplications ? "page" : undefined}
            className={navLinkClass(isApplications)}
          >
            {t("applications")}
          </Link>
          {userEmail && (
            <Link
              href="/passport"
              aria-current={isPassport ? "page" : undefined}
              className={navLinkClass(isPassport)}
            >
              {t("passport")}
            </Link>
          )}
          {userEmail && (
            <Link
              href="/routes"
              aria-current={isRoutes ? "page" : undefined}
              className={navLinkClass(isRoutes)}
            >
              {t("routes")}
            </Link>
          )}
          <Link
            href="/calendar"
            aria-current={isCalendar ? "page" : undefined}
            className={navLinkClass(isCalendar)}
          >
            {t("calendar")}
          </Link>
          <Link
            href="/explore"
            aria-current={isExplore ? "page" : undefined}
            className={navLinkClass(isExplore)}
          >
            {t("explore")}
          </Link>
          <Link
            href="/community"
            aria-current={isCommunity ? "page" : undefined}
            className={navLinkClass(isCommunity)}
          >
            {t("community")}
          </Link>
          {userEmail && (
            <Link
              href="/profile"
              aria-current={isProfile ? "page" : undefined}
              className={navLinkClass(isProfile)}
            >
              {t("profile")}
            </Link>
          )}
          <Link
            href="/applications/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-white transition-colors hover:bg-zinc-700"
          >
            {t("newApplication")}
          </Link>
          {userEmail && (
            <NotificationBell
              unreadCount={unreadNotificationCount}
              recentNotifications={recentNotifications}
            />
          )}
          <LanguageSwitcher />
          {userEmail ? (
            <form action={logOutAction.bind(null, locale)}>
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {t("logout")}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              {t("login")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
