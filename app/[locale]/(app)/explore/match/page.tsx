import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getUserState } from "@/app/lib/supabase/user-state";
import { createClient } from "@/app/lib/supabase/server";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";
import { getMatchProfileData } from "@/app/lib/data/match";
import { getCountryOptions } from "@/app/lib/countries";
import MatchQuizWizard from "@/app/components/match/MatchQuizWizard";
import GuestMatchQuizWizard from "@/app/components/match/GuestMatchQuizWizard";
import DevStateError from "@/app/components/DevStateError";

export default async function MatchQuizPage({
  params,
}: PageProps<"/[locale]/explore/match">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  const supabase = await createClient();
  await recordAnalyticsEvent(supabase, state.status === "unauthenticated" ? null : state.user.id, "match_started");

  // No hard login wall (task brief section 5) -- an unauthenticated visitor
  // gets the guest quiz instead of a login redirect. An account that exists
  // but hasn't finished onboarding still needs the real profile fields
  // filled in there first, so that path is unchanged.
  if (state.status === "unauthenticated") return <GuestMatchQuizWizard locale={locale} />;
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const { profileInputs, destinationCountries, priorities } = await getMatchProfileData(user.id, profile);

  const countryLabels = new Map(getCountryOptions(locale).map((c) => [c.code, c.label]));

  return (
    <MatchQuizWizard
      locale={locale}
      profileSummary={{
        destinationCountries: destinationCountries.map((code) => ({
          code,
          label: countryLabels.get(code) ?? code,
        })),
        fieldOfStudy: profileInputs.fieldOfStudy,
        applicationType: profileInputs.applicationType,
        maxTuition: profileInputs.maxTuition != null ? String(profileInputs.maxTuition) : null,
        tuitionCurrency: profileInputs.tuitionCurrency,
        priorities,
      }}
    />
  );
}
