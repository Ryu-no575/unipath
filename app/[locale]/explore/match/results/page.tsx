import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getMatchProfileData, getRealMatchCandidates } from "@/app/lib/data/match";
import { getCountryOptions } from "@/app/lib/countries";
import { computeRealMatches } from "@/app/lib/match/real-engine";
import { decodeMatchQuizAnswers } from "@/app/lib/match/query";
import RealMatchCard from "@/app/components/match/RealMatchCard";
import DevStateError from "@/app/components/DevStateError";

/**
 * Production Match Results: scores only real programs from
 * `public.universities` / `public.programs` (see
 * app/lib/data/match.ts:getRealMatchCandidates and
 * app/lib/match/real-engine.ts). Never includes the fictional demo catalog
 * (app/lib/match/demo-catalog.ts) -- that only renders at
 * /explore/match/demo, which is hard-gated to non-production (see AGENTS.md
 * task notes on Match Results / Demo separation). When the verified catalog
 * is too small to be useful, this says so plainly instead of either an empty
 * "no matches" dead end or padding the list with invented candidates.
 */
export default async function MatchResultsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/explore/match/results">) {
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
  const [{ profileInputs, destinationCountries }, candidates] = await Promise.all([
    getMatchProfileData(user.id, profile),
    getRealMatchCandidates(),
  ]);

  const computation = computeRealMatches({
    profile: profileInputs,
    destinationCountries,
    candidates,
  });

  const t = await getTranslations("MatchResults");
  const applicationTypeLabels = await getTranslations("ApplicationTypeOptions");
  const countryLabels = new Map(getCountryOptions(locale).map((c) => [c.code, c.label]));

  const degreeTypeSummary = profileInputs.applicationType
    ? t("hardConstraintsSummary", { filters: applicationTypeLabels(profileInputs.applicationType) })
    : t("hardConstraintsSummaryAll");

  const preferredCountriesLabel =
    destinationCountries.length > 0
      ? destinationCountries.map((code) => countryLabels.get(code) ?? code).join(", ")
      : null;

  const isDataLimited = computation.totalVerifiedPrograms === 0 || computation.results.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
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
          {t("realExcludedNotice", {
            excluded: computation.excludedCount,
            total: computation.totalVerifiedPrograms,
          })}
        </p>
      )}

      {isDataLimited ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900">
            {t("verifiedDataHeading", { count: computation.totalVerifiedPrograms })}
          </h2>
          <p className="text-sm text-zinc-500">{t("verifiedDataBody")}</p>
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
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            {t("verifiedDataHeading", { count: computation.totalVerifiedPrograms })}
          </p>
          {computation.results.map((result) => (
            <RealMatchCard key={result.candidate.programId} result={result} locale={locale} />
          ))}
        </div>
      )}

      {process.env.NODE_ENV !== "production" && (
        <Link
          href="/explore/match/demo"
          className="w-fit text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
        >
          {t("devDemoLinkNote")}
        </Link>
      )}
    </div>
  );
}
