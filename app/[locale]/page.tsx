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

  // Get Started must land the visitor on exactly one destination based on
  // getUserState() (the same single source of truth every protected page
  // uses) — never /dashboard unconditionally, or an unauthenticated /
  // needs-onboarding visitor bounces straight into the dashboard <->
  // onboarding redirect.
  const state = await getUserState();
  const ctaHref =
    state.status === "unauthenticated"
      ? "/signup"
      : state.status === "ready"
        ? "/dashboard"
        : "/onboarding";

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            {nav("brand")}
          </span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href="/dashboard"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              {nav("home")}
            </Link>
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

        <Link
          href={ctaHref}
          className="mt-10 inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("cta")}
        </Link>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
        {t("footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
