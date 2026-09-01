import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getUserState } from "@/app/lib/supabase/user-state";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Landing");
  const nav = await getTranslations("Navigation");

  // No hard login wall (task brief section 5): the primary CTA always shows
  // the marketing value first, and for a guest it drops straight into the
  // guest-usable Match funnel rather than a signup form. getUserState() (the
  // same single source of truth every protected page uses) decides only
  // *which* CTA/destination to show — never /dashboard unconditionally, or
  // an unauthenticated / needs-onboarding visitor bounces straight into the
  // dashboard <-> onboarding redirect.
  const state = await getUserState();
  const isGuest = state.status === "unauthenticated";
  const primaryCtaHref = isGuest ? "/explore/match" : state.status === "ready" ? "/dashboard" : "/onboarding";
  const primaryCtaLabel = isGuest ? t("ctaTryUniPath") : t("ctaContinueJourney");

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            {nav("brand")}
          </span>
          <div className="flex items-center gap-2">
            {isGuest && (
              <nav className="hidden items-center gap-1 sm:flex">
                <Link
                  href="/explore"
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {nav("explore")}
                </Link>
                <Link
                  href="/#how-it-works"
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {nav("howItWorks")}
                </Link>
              </nav>
            )}
            <LanguageSwitcher />
            {isGuest ? (
              <>
                <Link
                  href="/login"
                  className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {nav("login")}
                </Link>
                <Link
                  href="/explore"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  {nav("tryFree")}
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {nav("home")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm font-medium tracking-wide text-zinc-400">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl">
          {t("titleLine1")}
          <br />
          {t("titleLine2")}
        </h1>
        <p className="mt-6 max-w-md text-balance text-base leading-relaxed text-zinc-600 sm:text-lg">
          {t("subtitle")}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryCtaHref}
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {primaryCtaLabel}
          </Link>
          {isGuest && (
            <Link
              href="/explore"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              {t("ctaExploreUniversities")}
            </Link>
          )}
        </div>
      </main>

      {isGuest && (
        <section id="how-it-works" className="border-t border-zinc-200 bg-zinc-50 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {t("howItWorksHeading")}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {(
                [
                  ["1", t("howItWorksStep1Title"), t("howItWorksStep1Body")],
                  ["2", t("howItWorksStep2Title"), t("howItWorksStep2Body")],
                  ["3", t("howItWorksStep3Title"), t("howItWorksStep3Body")],
                ] as const
              ).map(([number, title, body]) => (
                <div key={number} className="flex flex-col items-center gap-3 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                    {number}
                  </span>
                  <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
        {t("footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
