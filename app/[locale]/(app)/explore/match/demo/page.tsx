import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getMatchProfileData } from "@/app/lib/data/match";
import { getCountryOptions } from "@/app/lib/countries";
import { computeMatches } from "@/app/lib/match/engine";
import { decodeMatchQuizAnswers } from "@/app/lib/match/query";
import MatchCard from "@/app/components/match/MatchCard";
import DevStateError from "@/app/components/DevStateError";

/**
 * Development-only preview of the fictional demo catalog
 * (app/lib/match/demo-catalog.ts) and its rich-attribute scoring engine
 * (app/lib/match/engine.ts) -- kept, not deleted, so the match-scoring UI
 * remains reviewable/demoable, but isolated behind this route (never linked
 * from production nav) and a hard NODE_ENV gate so it can never appear in
 * production Match Results (see app/[locale]/explore/match/results/page.tsx,
 * which is real-data-only). See AGENTS.md task notes on Demo separation.
 */
export default async function MatchDemoResultsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/explore/match/demo">) {
  if (process.env.NODE_ENV === "production") notFound();

  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const resolvedSearchParams = await searchParams;
  const quiz = decodeMatchQuizAnswers(resolvedSearchParams);
  if (!quiz) redirect(`/${locale}/explore/match`);

  const { user, profile } = state;
  const { profileInputs, destinationCountries, priorities } = await getMatchProfileData(user.id, profile);

  const computation = computeMatches({
    profile: profileInputs,
    destinationCountries,
    priorities,
    quiz,
  });

  const t = await getTranslations("MatchResults");
  const applicationTypeLabels = await getTranslations("ApplicationTypeOptions");
  const countryLabels = new Map(getCountryOptions(locale).map((c) => [c.code, c.label]));

  const degreeTypeSummary = computation.hardConstraints.applicationType
    ? t("hardConstraintsSummary", { filters: applicationTypeLabels(computation.hardConstraints.applicationType) })
    : t("hardConstraintsSummaryAll");

  const preferredCountriesLabel =
    computation.preferredCountries.length > 0
      ? computation.preferredCountries.map((code) => countryLabels.get(code) ?? code).join(", ")
      : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-800">
            {t("demoBadge")}
          </span>
        </div>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t("demoBanner")}
      </div>

      <p className="text-sm text-zinc-500">{t("disclaimer")}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
        <div className="flex flex-col gap-1">
          <span>{degreeTypeSummary}</span>
          {preferredCountriesLabel && (
            <span>{t("preferredCountriesNote", { countries: preferredCountriesLabel })}</span>
          )}
        </div>
        <Link href="/explore/match" className="font-medium text-zinc-700 underline underline-offset-2">
          {t("retakeQuiz")}
        </Link>
      </div>

      {computation.excludedCount > 0 && (
        <p className="text-xs text-zinc-400">
          {t("excludedNotice", {
            excluded: computation.excludedCount,
            total: computation.totalCount,
          })}
        </p>
      )}

      {computation.results.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900">{t("emptyHeading")}</h2>
          <p className="text-sm text-zinc-500">{t("emptyBody")}</p>
          <div className="flex gap-3">
            <Link
              href="/profile"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {t("goToProfile")}
            </Link>
            <Link
              href="/explore"
              className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700"
            >
              {t("backToExplore")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {computation.hasLimitedData && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              {t("limitedDataNote")}
            </p>
          )}
          {computation.displayResults.map((result) => (
            <MatchCard key={result.candidate.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
