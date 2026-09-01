import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { listUserVisaJourneys, visaEligibleApplications } from "@/app/lib/data/visa";
import StartVisaJourneyButton from "@/app/components/visa/StartVisaJourneyButton";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";

export default async function VisaCenterPage({ params }: PageProps<"/[locale]/plan/visa">) {
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
  const [applications, journeys] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    listUserVisaJourneys(supabase, user.id),
  ]);

  const t = await getTranslations("Visa");
  const eligible = visaEligibleApplications(applications);
  const startedApplicationIds = new Set(journeys.map((j) => j.applicationId).filter((id): id is string => Boolean(id)));
  const notYetStarted = eligible.filter((a) => !startedApplicationIds.has(a.id));

  if (eligible.length === 0 && journeys.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("heading")} description={t("subheading")} />
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={<Button href="/applications">{t("emptyCta")}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      {journeys.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {journeys.map((j) => (
            <Card key={j.id} interactive as={Link} href={`/plan/visa/${j.id}`} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {t("destinationLabel", { country: j.destinationCountry })}
                  </span>
                  <span className="text-base font-semibold text-zinc-900">{j.universityName ?? t("unknownUniversity")}</span>
                </div>
                <Badge tone={j.profileStatus === "verified" ? "success" : "warning"}>
                  {j.profileStatus === "verified" ? t("verified") : t("beingVerified")}
                </Badge>
              </div>
              <p className="text-sm text-zinc-500">
                {t("checklistProgress", { completed: j.completedItems, total: j.totalItems })}
              </p>
              <div className="h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-1.5 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${j.totalItems > 0 ? Math.round((j.completedItems / j.totalItems) * 100) : 0}%` }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {notYetStarted.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-700">{t("startNewHeading")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {notYetStarted.map((application) => (
              <Card key={application.id} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {t("destinationLabel", { country: application.university?.countryCode ?? "" })}
                  </span>
                  <span className="text-base font-semibold text-zinc-900">
                    {application.university?.name ?? t("unknownUniversity")}
                  </span>
                </div>
                <StartVisaJourneyButton locale={typedLocale} applicationId={application.id} />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
