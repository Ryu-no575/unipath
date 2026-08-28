import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { Route } from "@/app/lib/routes/types";
import { routeStepLabel } from "@/app/lib/routes/labels";
import { setActiveRouteAction } from "@/app/lib/actions/routes";
import RouteQuickStats from "./RouteQuickStats";
import RouteFeasibilityBanner from "./RouteFeasibilityBanner";
import RouteReasonsList from "./RouteReasonsList";

const FEASIBILITY_LEVEL_CLASSES: Record<Route["feasibilityLevel"], string> = {
  comfortable: "bg-emerald-50 text-emerald-700",
  feasible: "bg-emerald-50 text-emerald-700",
  tight: "bg-amber-50 text-amber-700",
  very_tight: "bg-amber-50 text-amber-800",
  not_feasible: "bg-red-50 text-red-700",
  unknown_deadline: "bg-zinc-100 text-zinc-500",
};

export default function RouteCard({
  route,
  hrefQuery = "",
  locale,
  isActive = false,
  isRecommended = false,
}: {
  route: Route;
  hrefQuery?: string;
  locale: AppLocale;
  isActive?: boolean;
  isRecommended?: boolean;
}) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const descT = useTranslations("RouteTypeDescriptions");
  const stepTypes = useTranslations("RouteStepTypeOptions");
  const stepDetails = useTranslations("RouteStepDetails");
  const documentTypes = useTranslations("DocumentTypeOptions");
  const levelT = useTranslations("RouteFeasibilityLevelOptions");

  const completedCount = route.steps.filter((s) => s.status === "done").length;
  const currentLabel = route.currentStep
    ? routeStepLabel(route.currentStep, { stepTypes, stepDetails, documentTypes: (key) => documentTypes(key) })
    : null;

  return (
    <div className={`flex flex-col gap-5 rounded-xl border bg-white p-6 ${isActive ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">{typeT(route.type)}</h2>
            {isActive && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {t("activeRoute")}
              </span>
            )}
            {isRecommended && !isActive && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {t("recommendedBadge")}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">{descT(route.type)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {t("stepsCompleted", { done: completedCount, total: route.steps.length })}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${FEASIBILITY_LEVEL_CLASSES[route.feasibilityLevel]}`}>
            {levelT(route.feasibilityLevel)}
          </span>
        </div>
      </div>

      <RouteFeasibilityBanner feasibility={route.comparison.feasibility} />

      <RouteQuickStats routeType={route.type} comparison={route.comparison} />

      {currentLabel && (
        <div className="flex flex-col gap-1 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            {t("nextActionHeading")}
          </span>
          <span className="text-sm font-semibold text-zinc-900">{currentLabel.title}</span>
          <span className="text-sm text-zinc-600">{currentLabel.detail}</span>
        </div>
      )}

      <RouteReasonsList reasons={route.reasons} />

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Link
          href={`/routes/${route.type}${hrefQuery}`}
          className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("viewFullMap")}
        </Link>
        {!isActive && (
          <form action={setActiveRouteAction.bind(null, locale, route.type)}>
            <button
              type="submit"
              className="inline-flex w-fit items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              {t("useThisRoute")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
