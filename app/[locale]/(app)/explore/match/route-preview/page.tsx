import { hasLocale } from "next-intl";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";
import GuestRoutePreview from "@/app/components/match/GuestRoutePreview";
import SaveGuestResultsPrompt from "@/app/components/match/SaveGuestResultsPrompt";
import ShareMyUniPath from "@/app/components/match/ShareMyUniPath";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * The last stop of the guest Match funnel (task brief section 3: Landing ->
 * Find My Match -> quiz -> Top 5 Matches -> Route Preview -> save gate).
 * Public and stateless -- everything it renders comes from the URL (the top
 * match's own display fields, forwarded by explore/match/results/page.tsx),
 * never a DB read, so it works with no account and saves nothing. The save
 * gate (SaveGuestResultsPrompt) only shows for an actual guest -- a signed-in
 * visitor who lands here directly has no reason to see a signup prompt.
 */
export default async function GuestRoutePreviewPage({
  params,
  searchParams,
}: PageProps<"/[locale]/explore/match/route-preview">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;
  const universityName = firstParam(resolvedSearchParams.university);
  if (!universityName) redirect(`/${locale}/explore/match`);

  const programName = firstParam(resolvedSearchParams.program);
  const deadlineISO = firstParam(resolvedSearchParams.deadline);
  const countryCode = firstParam(resolvedSearchParams.country);
  const back = firstParam(resolvedSearchParams.back) ?? "";
  const resultsHref = back ? `/explore/match/results?${back}` : "/explore/match/results";
  const deadlineYear = deadlineISO ? String(new Date(deadlineISO).getFullYear()) : null;

  const format = await getFormatter();
  const deadlineLabel = deadlineISO ? format.dateTime(new Date(deadlineISO), "long") : null;

  const user = await getOptionalUser();
  const supabase = await createClient();
  await recordAnalyticsEvent(supabase, user?.id ?? null, "route_viewed", { guest: !user });

  return (
    <div className="flex flex-col gap-8">
      <GuestRoutePreview
        universityName={universityName}
        programName={programName}
        deadlineLabel={deadlineLabel}
        resultsHref={resultsHref}
      />
      <div className="flex justify-center">
        <ShareMyUniPath
          university={universityName}
          program={programName}
          destination={countryCode}
          year={deadlineYear}
        />
      </div>
      {!user && <SaveGuestResultsPrompt locale={locale} />}
    </div>
  );
}
