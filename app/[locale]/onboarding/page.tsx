import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { profileToFormValues } from "@/app/lib/profile-types";
import OnboardingWizard from "@/app/components/profile/OnboardingWizard";
import DevStateError from "@/app/components/DevStateError";

export default async function OnboardingPage({
  params,
}: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  // Only an explicitly-completed profile sends the user away from
  // onboarding. A query error must NOT be treated as "still needs
  // onboarding" or "already done" — either would risk bouncing the user
  // straight back to /dashboard or /onboarding and forming a loop.
  if (state.status === "error") return <DevStateError message={state.message} />;
  if (state.status === "ready") redirect(`/${locale}/dashboard`);

  const { user, profile } = state;
  const supabase = await createClient();
  const [{ data: destinations }, { data: priorities }] = await Promise.all([
    supabase.from("profile_destination_preferences").select("*").eq("user_id", user.id),
    supabase.from("profile_priorities").select("*").eq("user_id", user.id),
  ]);

  const initialValues = profileToFormValues(profile, destinations ?? [], priorities ?? []);

  return <OnboardingWizard locale={locale} initialValues={initialValues} />;
}
