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
import { buildComparisonRows } from "@/app/lib/routes/routeComparatorTable";
import RouteComparisonTable from "@/app/components/routes/RouteComparisonTable";
import RouteRecommendationBanner from "@/app/components/routes/RouteRecommendationBanner";
import DevStateError from "@/app/components/DevStateError";

/** Task brief item 14: "Compare Routes" screen -- all 5 routes generated
 * once, side by side, from the same real RouteEngineInput every other Route
 * page uses. */
export default async function RouteComparePage({ params }: PageProps<"/[locale]/routes/compare">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const input = await getRouteEngineInput(supabase, user.id, profile);
  const routes = generateAllRoutes(input);
  const recommendation = recommendRoute(routes, input.scholarshipNeed);
  const rows = buildComparisonRows(routes, ROUTE_TYPES);

  const t = await getTranslations("Routes");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/routes" className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
          {t("backToRoutes")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("compareHeading")}</h1>
        <p className="text-sm text-zinc-500">{t("compareSubheading")}</p>
      </div>

      <RouteRecommendationBanner recommendation={recommendation} />

      <RouteComparisonTable rows={rows} />
    </div>
  );
}
