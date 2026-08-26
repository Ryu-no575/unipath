import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getMatchProfileData } from "@/app/lib/data/match";
import { getCountryOptions } from "@/app/lib/countries";
import MatchQuizWizard from "@/app/components/match/MatchQuizWizard";
import DevStateError from "@/app/components/DevStateError";

export default async function MatchQuizPage({
  params,
}: PageProps<"/[locale]/explore/match">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
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
