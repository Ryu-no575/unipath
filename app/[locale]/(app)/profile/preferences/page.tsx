import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { profileToFormValues } from "@/app/lib/profile-types";
import ProfileEditForm from "@/app/components/profile/ProfileEditForm";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";

export default async function ProfilePreferencesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const [{ data: destinations }, { data: priorities }] = await Promise.all([
    supabase.from("profile_destination_preferences").select("*").eq("user_id", user.id),
    supabase.from("profile_priorities").select("*").eq("user_id", user.id),
  ]);

  const initialValues = profileToFormValues(profile, destinations ?? [], priorities ?? []);
  const t = await getTranslations("Profile");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("tabPreferences")} />

      <ProfileEditForm
        locale={locale}
        initialValues={initialValues}
        sections={["destination", "budget", "priorities"]}
      />
    </div>
  );
}
