import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { visaEligibleApplications } from "@/app/lib/data/visa";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import SectionHeader from "@/app/components/ui/SectionHeader";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import GuidanceChecklistItem from "@/app/components/plan/GuidanceChecklistItem";

const ITEM_KEYS = [
  "flight",
  "arrivalDate",
  "airportTransfer",
  "documents",
  "sim",
  "money",
  "insurance",
  "packing",
  "arrivalInstructions",
] as const;

export default async function TravelPage({ params }: PageProps<"/[locale]/plan/travel">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user } = state;
  const supabase = await createClient();
  const [applications, { data: tasks }] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    supabase.from("tasks").select("id, application_id, title").eq("user_id", user.id).eq("task_type", "travel"),
  ]);

  const t = await getTranslations("Travel");
  const eligible = visaEligibleApplications(applications);

  if (eligible.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("heading")} description={t("subheading")} />
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} action={<Button href="/applications">{t("emptyCta")}</Button>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />
      <p className="rounded-md bg-zinc-50 px-4 py-3 text-sm text-zinc-500">{t("noPricesNote")}</p>

      {eligible.map((application) => {
        const applicationTasks = (tasks ?? []).filter((task) => task.application_id === application.id);
        const addedTitles = new Set(applicationTasks.map((task) => task.title));

        return (
          <div key={application.id} className="flex flex-col gap-4">
            <SectionHeader title={application.university?.name ?? t("unknownUniversity")} />
            <Card padding="none">
              <ul className="divide-y divide-zinc-100 px-6">
                {ITEM_KEYS.map((key) => {
                  const title = t(`items.${key}`);
                  return (
                    <GuidanceChecklistItem
                      key={key}
                      locale={typedLocale}
                      applicationId={application.id}
                      taskType="travel"
                      title={title}
                      alreadyAdded={addedTitles.has(title)}
                    />
                  );
                })}
              </ul>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
