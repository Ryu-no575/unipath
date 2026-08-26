import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import ApplicationsList from "@/app/components/applications/ApplicationsList";
import DevStateError from "@/app/components/DevStateError";

export default async function ApplicationsPage({
  params,
}: PageProps<"/[locale]/applications">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const applications = await getApplicationsWithDetails(supabase, user.id);
  const t = await getTranslations("Applications");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {t("heading")}
          </h1>
          <p className="text-sm text-zinc-500">{t("subheading")}</p>
        </div>
        <Link
          href="/applications/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("newApplication")}
        </Link>
      </div>

      <ApplicationsList applications={applications} userTimezone={profile.timezone} />
    </div>
  );
}
