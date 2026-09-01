import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateAllRoutes, recommendRoute } from "@/app/lib/routes/generateRoute";
import { ROUTE_TYPES } from "@/app/lib/routes/types";
import { getActiveRouteType } from "@/app/lib/routes/activeRoute";
import RouteCard from "@/app/components/routes/RouteCard";
import RouteNextActionBanner from "@/app/components/routes/RouteNextActionBanner";
import RouteRecommendationBanner from "@/app/components/routes/RouteRecommendationBanner";
import DevStateError from "@/app/components/DevStateError";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function RoutesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/routes">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
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
  const routes = generateAllRoutes(input);
  const activeRouteType = getActiveRouteType(profile);
  const recommendation = recommendRoute(routes, input.scholarshipNeed);
  await recordAnalyticsEvent(supabase, user.id, "route_viewed", { activeRouteType });

  const t = await getTranslations("Routes");
  const hrefQuery = targetUniversityId
    ? `?university=${encodeURIComponent(targetUniversityId)}${targetProgramId ? `&program=${encodeURIComponent(targetProgramId)}` : ""}`
    : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      {input.target && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <span className="text-blue-800">{t("scopedForUniversity", { university: input.target.universityName })}</span>
          <Link href="/routes" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
            {t("clearScope")}
          </Link>
        </div>
      )}

      <RouteNextActionBanner route={routes[activeRouteType]} />

      <RouteRecommendationBanner recommendation={recommendation} />

      <div className="flex justify-end">
        <Link href={`/routes/compare${hrefQuery}`} className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
          {t("compareRoutesLink")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ROUTE_TYPES.map((type) => (
          <RouteCard
            key={type}
            route={routes[type]}
            hrefQuery={hrefQuery}
            locale={locale}
            isActive={type === activeRouteType}
            isRecommended={type === recommendation.recommendedType}
          />
        ))}
      </div>
    </div>
  );
}
