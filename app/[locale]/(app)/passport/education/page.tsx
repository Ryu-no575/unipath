import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getEducationHistory } from "@/app/lib/data/passport";
import DevStateError from "@/app/components/DevStateError";
import EducationList from "@/app/components/passport/EducationList";
import PageHeader from "@/app/components/ui/PageHeader";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Card from "@/app/components/ui/Card";

export default async function PassportEducationPage({
  params,
}: PageProps<"/[locale]/passport/education">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const education = await getEducationHistory(supabase, user.id);

  const t = await getTranslations("PassportEducation");
  const qualificationTypeT = await getTranslations("QualificationTypeOptions");

  const hasPrimary = Boolean(profile.previous_institution || profile.education_level);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/passport" className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        {t("back")}
      </Link>

      <PageHeader title={t("heading")} description={t("subheading")} />

      <Card className="flex flex-col gap-2">
        <SectionHeader
          title={t("primaryHeading")}
          action={
            <Link href="/profile" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
              {t("editInProfile")}
            </Link>
          }
        />
        {hasPrimary ? (
          <div className="grid grid-cols-1 gap-2 text-sm text-zinc-700 sm:grid-cols-2">
            <p>{profile.previous_institution}</p>
            <p>{profile.qualification_type ? qualificationTypeT(profile.qualification_type) : profile.education_level}</p>
            {profile.gpa_value != null && (
              <p>
                GPA {profile.gpa_value}
                {profile.gpa_scale != null ? ` / ${profile.gpa_scale}` : ""}
              </p>
            )}
            <p>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                {t("userReported")}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">{t("primaryEmpty")}</p>
        )}
      </Card>

      <EducationList locale={locale} education={education} />
    </div>
  );
}
