import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
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

export default async function HousingPage({ params }: PageProps<"/[locale]/plan/housing">) {
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
    supabase.from("tasks").select("id, application_id, title").eq("user_id", user.id).eq("task_type", "housing"),
  ]);

  const t = await getTranslations("Housing");
  const eligible = visaEligibleApplications(applications);

  if (eligible.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("heading")} description={t("subheading")} />
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} action={<Button href="/applications">{t("emptyCta")}</Button>} />
      </div>
    );
  }

  const documentItems = [
    { key: "proofOfEnrollment", title: t("items.proofOfEnrollment") },
    { key: "proofOfFunds", title: t("items.proofOfFunds") },
    { key: "guarantorReference", title: t("items.guarantorReference") },
    { key: "idCopy", title: t("items.idCopy") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      {eligible.map((application) => {
        const applicationTasks = (tasks ?? []).filter((task) => task.application_id === application.id);
        const addedTitles = new Set(applicationTasks.map((task) => task.title));

        return (
          <div key={application.id} className="flex flex-col gap-6">
            <SectionHeader title={application.university?.name ?? t("unknownUniversity")} />

            <Card className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-zinc-700">{t("whenToStartHeading")}</h3>
              <p className="text-sm text-zinc-600">{t("whenToStartBody")}</p>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-zinc-700">{t("universityAccommodationHeading")}</h3>
                <p className="text-sm text-zinc-600">{t("universityAccommodationBody")}</p>
                {application.university?.officialWebsite && (
                  <a
                    href={application.university.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
                  >
                    {t("visitOfficialWebsite")}
                  </a>
                )}
              </Card>
              <Card className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-zinc-700">{t("privateHousingHeading")}</h3>
                <p className="text-sm text-zinc-600">{t("privateHousingBody")}</p>
              </Card>
            </div>

            <Card padding="none">
              <div className="p-6 pb-0">
                <h3 className="text-sm font-semibold text-zinc-700">{t("documentsHeading")}</h3>
              </div>
              <ul className="divide-y divide-zinc-100 px-6">
                {documentItems.map((item) => (
                  <GuidanceChecklistItem
                    key={item.key}
                    locale={typedLocale}
                    applicationId={application.id}
                    taskType="housing"
                    title={item.title}
                    alreadyAdded={addedTitles.has(item.title)}
                  />
                ))}
              </ul>
            </Card>

            <Card className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-zinc-700">{t("communityBridgeHeading")}</h3>
              <p className="text-sm text-zinc-600">{t("communityBridgeBody")}</p>
              <Link
                href={`/universities/${application.university?.id ?? ""}/community?type=housing`}
                className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
              >
                {t("communityBridgeCta")}
              </Link>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
