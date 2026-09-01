import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getVisaJourneyDetail } from "@/app/lib/data/visa";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateRoute } from "@/app/lib/routes/generateRoute";
import { getActiveRouteType } from "@/app/lib/routes/activeRoute";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import SectionHeader from "@/app/components/ui/SectionHeader";
import VisaChecklistItem from "@/app/components/visa/VisaChecklistItem";

export default async function VisaJourneyDetailPage({
  params,
}: PageProps<"/[locale]/plan/visa/[journeyId]">) {
  const { locale, journeyId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const journey = await getVisaJourneyDetail(supabase, user.id, journeyId);
  if (!journey) notFound();

  const t = await getTranslations("Visa");

  const routeInput = await getRouteEngineInput(supabase, user.id, profile);
  const route = generateRoute(routeInput, getActiveRouteType(profile));
  const visaStep = route.steps.find((s) => s.type === "visa") ?? null;
  const travelStep = route.steps.find((s) => s.type === "travel") ?? null;

  const requiredItems = journey.items.filter((i) => i.required);
  const optionalItems = journey.items.filter((i) => !i.required);
  const completedCount = journey.items.filter((i) => i.completed).length;

  function formatDate(iso: string | null): string {
    if (!iso) return t("timelineDateUnknown");
    return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("journeyHeading", { country: journey.destinationCountry })}
        description={t("journeySubheading", { nationality: journey.nationalityCountry })}
      />

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={journey.profileStatus === "verified" ? "success" : "warning"}>
              {journey.profileStatus === "verified" ? t("verified") : t("beingVerified")}
            </Badge>
            {journey.visaType && <Badge tone="neutral">{journey.visaType}</Badge>}
          </div>
          <span className="text-xs text-zinc-400">
            {journey.lastCheckedAt ? t("lastChecked", { date: formatDate(journey.lastCheckedAt) }) : t("neverChecked")}
          </span>
        </div>
        {journey.summary && <p className="text-sm text-zinc-600">{journey.summary}</p>}
        {journey.profileStatus === "being_verified" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("beingVerifiedExplainer")}</p>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <SectionHeader title={t("timelineHeading")} />
        <Card>
          <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
            <TimelineNode label={t("timelineEnrollment")} date={t("timelineEnrollmentDone")} official />
            <TimelineConnector />
            <TimelineNode
              label={t("timelineVisaPreparation")}
              date={
                visaStep?.date?.suggestedDate
                  ? formatDate(visaStep.date.suggestedDate)
                  : visaStep?.status === "done"
                    ? t("timelineDone")
                    : t("timelineDateUnknown")
              }
              official={false}
            />
            <TimelineConnector />
            <TimelineNode
              label={t("timelineTravel")}
              date={
                travelStep?.date?.suggestedDate
                  ? formatDate(travelStep.date.suggestedDate)
                  : travelStep?.status === "done"
                    ? t("timelineDone")
                    : t("timelineDateUnknown")
              }
              official={false}
              last
            />
          </ol>
          <p className="mt-4 text-xs text-zinc-400">{t("timelineDisclaimer")}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeader
          title={t("checklistHeading")}
          action={
            <span className="text-sm text-zinc-500">
              {t("checklistProgress", { completed: completedCount, total: journey.items.length })}
            </span>
          }
        />
        <Card padding="none">
          {journey.items.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">{t("checklistEmpty")}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 px-6">
              {requiredItems.map((item) => (
                <VisaChecklistItem key={item.id} locale={typedLocale} journeyId={journey.id} item={item} />
              ))}
              {optionalItems.map((item) => (
                <VisaChecklistItem key={item.id} locale={typedLocale} journeyId={journey.id} item={item} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {journey.sources.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionHeader title={t("sourcesHeading")} />
          <Card className="flex flex-col gap-3">
            {journey.sources.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-zinc-700 underline underline-offset-2 hover:text-zinc-900">
                    {s.url}
                  </a>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
                <span className="text-xs text-zinc-400">
                  {s.lastCheckedAt ? t("lastChecked", { date: formatDate(s.lastCheckedAt) }) : t("neverChecked")}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function TimelineNode({
  label,
  date,
  official,
  last = false,
}: {
  label: string;
  date: string;
  official: boolean;
  last?: boolean;
}) {
  return (
    <li className={`flex flex-1 flex-col gap-1 px-4 py-2 ${last ? "" : "sm:border-r sm:border-zinc-100"}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-900">{date}</span>
      {!official && <span className="text-[10px] uppercase tracking-wide text-blue-500">UniPath Suggested</span>}
    </li>
  );
}

function TimelineConnector() {
  return (
    <li className="hidden items-center px-1 text-zinc-300 sm:flex" aria-hidden>
      →
    </li>
  );
}
