import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateRoute } from "@/app/lib/routes/generateRoute";
import { ROUTE_TYPES, type RouteType } from "@/app/lib/routes/types";
import RouteMap from "@/app/components/routes/RouteMap";
import RouteComparisonStats from "@/app/components/routes/RouteComparisonStats";
import RouteReasonsList from "@/app/components/routes/RouteReasonsList";
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

  const t = await getTranslations("Routes");
  const typeT = await getTranslations("RouteTypeOptions");
  const descT = await getTranslations("RouteTypeDescriptions");

  const hrefQuery = targetUniversityId
    ? `?university=${encodeURIComponent(targetUniversityId)}${targetProgramId ? `&program=${encodeURIComponent(targetProgramId)}` : ""}`
    : "";

  return (
    <div className="flex flex-col gap-8">
      <Link href={`/routes${hrefQuery}`} className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        {t("backToRoutes")}
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{typeT(type)}</h1>
        <p className="text-sm text-zinc-500">{descT(type)}</p>
        {route.scopedUniversityName && (
          <p className="mt-1 text-sm text-blue-700">{t("scopedForUniversity", { university: route.scopedUniversityName })}</p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RouteComparisonStats comparison={route.comparison} />
      </div>

      <RouteMap steps={route.steps} userTimezone={profile.timezone} />

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <RouteReasonsList reasons={route.reasons} />
      </div>
    </div>
  );
}
