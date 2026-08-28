import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateRoute } from "@/app/lib/routes/generateRoute";
import { getActiveRouteType } from "@/app/lib/routes/activeRoute";
import { compareRoutes } from "@/app/lib/routes/routeDiff";
import { routeDiffLabel } from "@/app/lib/routes/labels";
import { buildRouteSuggestedEvents } from "@/app/lib/routes/routeCalendarSync";
import { setActiveRouteAction } from "@/app/lib/actions/routes";
import { ROUTE_TYPES, type RouteType } from "@/app/lib/routes/types";
import RouteMap from "@/app/components/routes/RouteMap";
import RouteQuickStats from "@/app/components/routes/RouteQuickStats";
import RouteComparisonStats from "@/app/components/routes/RouteComparisonStats";
import RouteFeasibilityBanner from "@/app/components/routes/RouteFeasibilityBanner";
import RouteReasonsList from "@/app/components/routes/RouteReasonsList";
import RouteScorecard from "@/app/components/routes/RouteScorecard";
import RouteWorkload from "@/app/components/routes/RouteWorkload";
import RouteCapacityForm from "@/app/components/routes/RouteCapacityForm";
import RouteBottlenecks from "@/app/components/routes/RouteBottlenecks";
import RouteScenarios from "@/app/components/routes/RouteScenarios";
import RoutePortfolioStrategy from "@/app/components/routes/RoutePortfolioStrategy";
import RouteUniverseCandidates from "@/app/components/routes/RouteUniverseCandidates";
import DevStateError from "@/app/components/DevStateError";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isRouteType(value: string): value is RouteType {
  return (ROUTE_TYPES as string[]).includes(value);
}

export default async function RouteDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/routes/[type]">) {
  const { locale, type } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isRouteType(type)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const resolvedSearchParams = await searchParams;
  const targetUniversityId = firstParam(resolvedSearchParams.university);
  const targetProgramId = firstParam(resolvedSearchParams.program);

  const { user, profile } = state;
  const supabase = await createClient();
  const input = await getRouteEngineInput(supabase, user.id, profile, {
    targetUniversityId,
    targetProgramId,
  });
  const route = generateRoute(input, type);
  const activeRouteType = getActiveRouteType(profile);
  const isActive = activeRouteType === type;
  const diff = isActive ? [] : compareRoutes(generateRoute(input, activeRouteType), route);

  const t = await getTranslations("Routes");
  const typeT = await getTranslations("RouteTypeOptions");
  const descT = await getTranslations("RouteTypeDescriptions");
  const diffT = await getTranslations("RouteDiffs");
  const stepTypesT = await getTranslations("RouteStepTypeOptions");
  const format = await getFormatter();

  const calendarEvents = buildRouteSuggestedEvents(route, (t2) => stepTypesT(t2), route.scopedUniversityName);
  const earliestCalendarEvent =
    calendarEvents.length > 0
      ? calendarEvents.reduce((earliest, e) => (e.dueAt < earliest ? e.dueAt : earliest), calendarEvents[0].dueAt)
      : null;

  const hrefQuery = targetUniversityId
    ? `?university=${encodeURIComponent(targetUniversityId)}${targetProgramId ? `&program=${encodeURIComponent(targetProgramId)}` : ""}`
    : "";

  return (
    <div className="flex flex-col gap-8">
      <Link href={`/routes${hrefQuery}`} className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        {t("backToRoutes")}
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{typeT(type)}</h1>
          {isActive && (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {t("activeRoute")}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500">{descT(type)}</p>
        {route.scopedUniversityName && (
          <p className="mt-1 text-sm text-blue-700">{t("scopedForUniversity", { university: route.scopedUniversityName })}</p>
        )}
      </div>

      <RouteFeasibilityBanner feasibility={route.comparison.feasibility} />

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RouteQuickStats routeType={route.type} comparison={route.comparison} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">{t("calendarImpactHeading")}</h2>
        <p className="text-sm text-zinc-600">
          {calendarEvents.length > 0 && earliestCalendarEvent
            ? t("calendarImpactSummary", {
                count: calendarEvents.length,
                date: format.dateTime(new Date(earliestCalendarEvent), "long"),
              })
            : t("calendarImpactEmpty")}
        </p>
        <Link href="/calendar" className="w-fit text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
          {t("viewInCalendar")}
        </Link>
      </div>

      {!isActive && diff.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {t("whatChangesHeading", { route: typeT(type) })}
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {diff.map((entry, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
                <span>{routeDiffLabel(entry, diffT, stepTypesT)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isActive && (
        <form action={setActiveRouteAction.bind(null, locale, type)}>
          <button
            type="submit"
            className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {t("useThisRoute")}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RouteComparisonStats comparison={route.comparison} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">{t("scorecardHeading")}</h2>
        <RouteScorecard scorecard={route.scorecard} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">{t("workloadHeading")}</h2>
          <RouteWorkload workload={route.workload} />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">{t("capacityHeading")}</h2>
          <RouteCapacityForm capacity={route.capacity} locale={locale} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <RouteBottlenecks bottlenecks={route.bottlenecks} />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <RouteScenarios scenarios={route.scenarios} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RoutePortfolioStrategy portfolio={route.portfolio} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RouteUniverseCandidates candidates={route.recommendedCandidates} />
      </div>

      <RouteMap steps={route.steps} userTimezone={profile.timezone} />

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RouteReasonsList reasons={route.reasons} />
      </div>
    </div>
  );
}
