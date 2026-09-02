import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getUserState } from "@/app/lib/supabase/user-state";
import { createClient } from "@/app/lib/supabase/server";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";
import { getMatchProfileData, getRealMatchCandidates } from "@/app/lib/data/match";
import { getCountryOptions } from "@/app/lib/countries";
import { computeRealMatches } from "@/app/lib/match/real-engine";
import { decodeMatchQuizAnswers } from "@/app/lib/match/query";
import { decodeGuestMatchQuery } from "@/app/lib/match/guestQuery";
import RealMatchCard from "@/app/components/match/RealMatchCard";
import ShareMyUniPath from "@/app/components/match/ShareMyUniPath";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

const GUEST_RESULT_LIMIT = 5;

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
 *
 * An unauthenticated visitor gets the same real, verified catalog scored
 * against their Guest Match Quiz answers (see guestQuery.ts) instead of an
 * account profile, capped to the top 5 (task brief section 3) -- never a
 * login redirect, per section 5's "no hard login wall".
 */
export default async function MatchResultsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/explore/match/results">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const resolvedSearchParams = await searchParams;
  const t = await getTranslations("MatchResults");
  const applicationTypeLabels = await getTranslations("ApplicationTypeOptions");
  const countryLabels = new Map(getCountryOptions(locale).map((c) => [c.code, c.label]));

  if (state.status === "unauthenticated") {
    const guest = decodeGuestMatchQuery(resolvedSearchParams);
    if (!guest) redirect(`/${locale}/explore/match`);

    const candidates = await getRealMatchCandidates();
    const computation = computeRealMatches({
      profile: guest.profileInputs,
      destinationCountries: guest.destinationCountries,
      candidates,
    });
    const supabase = await createClient();
    await recordAnalyticsEvent(supabase, null, "match_completed", { guest: true });
    const topResults = computation.results.slice(0, GUEST_RESULT_LIMIT);
    const isDataLimited = computation.totalVerifiedPrograms === 0 || topResults.length === 0;
    const gt = await getTranslations("Guest");

    const degreeTypeSummary = guest.profileInputs.applicationType
      ? t("hardConstraintsSummary", { filters: applicationTypeLabels(guest.profileInputs.applicationType) })
      : t("hardConstraintsSummaryAll");
    const preferredCountriesLabel =
      guest.destinationCountries.length > 0
        ? guest.destinationCountries.map((code) => countryLabels.get(code) ?? code).join(", ")
        : null;

    // Carries the guest's original quiz-answer params along to Route
    // Preview so its own "back to results" link can return here without
    // losing them (see GuestRoutePreview's resultsHref) -- Route Preview
    // never needs to decode these itself, only round-trip them.
    const backQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      const single = Array.isArray(value) ? value[0] : value;
      if (typeof single === "string") backQuery.set(key, single);
    }

    const topMatch = topResults[0] ?? null;
    let routePreviewHref: string | null = null;
    if (topMatch) {
      const previewParams = new URLSearchParams({
        university: topMatch.candidate.universityName,
        back: backQuery.toString(),
      });
      if (topMatch.candidate.programName) previewParams.set("program", topMatch.candidate.programName);
      if (topMatch.candidate.applicationDeadline) {
        previewParams.set("deadline", topMatch.candidate.applicationDeadline);
      }
      if (topMatch.candidate.countryCode) previewParams.set("country", topMatch.candidate.countryCode);
      routePreviewHref = `/explore/match/route-preview?${previewParams.toString()}`;
    }

    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("heading")} description={t("subheading")} />

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

        {isDataLimited ? (
          <EmptyState
            title={t("verifiedDataHeading", { count: computation.totalVerifiedPrograms })}
            description={t("verifiedDataBody")}
            action={<Button href="/explore">{t("backToExplore")}</Button>}
          />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {topResults.map((result, index) => (
                <RealMatchCard
                  key={result.candidate.programId}
                  result={result}
                  locale={locale}
                  guest
                  variant={index === 0 ? "hero" : "default"}
                  profile={index === 0 ? guest.profileInputs : undefined}
                  destinationCountries={index === 0 ? guest.destinationCountries : undefined}
                />
              ))}
            </div>

            {routePreviewHref && (
              <div className="flex flex-col items-center gap-3 pt-2 text-center">
                <Link
                  href={routePreviewHref}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-primary-dark"
                >
                  {gt("seeRoutePreview")}
                </Link>
                {topMatch && (
                  <ShareMyUniPath
                    university={topMatch.candidate.universityName}
                    program={topMatch.candidate.programName}
                    destination={topMatch.candidate.countryCode}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

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
      <PageHeader title={t("heading")} description={t("subheading")} />

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
        <EmptyState
          title={t("verifiedDataHeading", { count: computation.totalVerifiedPrograms })}
          description={t("verifiedDataBody")}
          action={
            <div className="flex gap-3">
              <Button href="/profile" variant="secondary">
                {t("goToProfile")}
              </Button>
              <Button href="/explore">{t("backToExplore")}</Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            {t("verifiedDataHeading", { count: computation.totalVerifiedPrograms })}
          </p>
          {computation.results.map((result, index) => (
            <RealMatchCard
              key={result.candidate.programId}
              result={result}
              locale={locale}
              variant={index === 0 ? "hero" : "default"}
              profile={index === 0 ? profileInputs : undefined}
              destinationCountries={index === 0 ? destinationCountries : undefined}
            />
          ))}
          {computation.results[0] && (
            <div className="flex justify-center pt-2">
              <ShareMyUniPath
                university={computation.results[0].candidate.universityName}
                program={computation.results[0].candidate.programName}
                destination={computation.results[0].candidate.countryCode}
              />
            </div>
          )}
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
