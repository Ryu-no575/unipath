import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getUserState } from "@/app/lib/supabase/user-state";
import { logOutAction } from "@/app/lib/actions/auth";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Button from "@/app/components/ui/Button";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

export default async function ProfileSettingsPage({
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

  const { user } = state;
  const t = await getTranslations("Profile");
  const navT = await getTranslations("Navigation");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("tabSettings")} />

      <Card className="flex flex-col gap-4">
        <SectionHeader title={t("settingsAccountHeading")} />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("settingsEmailLabel")}
          </span>
          <span className="text-sm text-zinc-900">{user.email}</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <SectionHeader title={t("settingsLanguageHeading")} />
          <p className="text-sm text-zinc-500">{t("settingsLanguageBody")}</p>
        </div>
        <LanguageSwitcher />
      </Card>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <SectionHeader title={t("settingsLogoutHeading")} />
          <p className="text-sm text-zinc-500">{t("settingsLogoutBody")}</p>
        </div>
        <form action={logOutAction.bind(null, locale)}>
          <Button type="submit" variant="secondary">
            {navT("logout")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
