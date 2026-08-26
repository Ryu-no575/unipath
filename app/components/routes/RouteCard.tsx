import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Route } from "@/app/lib/routes/types";
import { routeStepLabel } from "@/app/lib/routes/labels";
import RouteComparisonStats from "./RouteComparisonStats";
import RouteReasonsList from "./RouteReasonsList";

export default function RouteCard({ route, hrefQuery = "" }: { route: Route; hrefQuery?: string }) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const descT = useTranslations("RouteTypeDescriptions");
  const stepTypes = useTranslations("RouteStepTypeOptions");
  const stepDetails = useTranslations("RouteStepDetails");
  const documentTypes = useTranslations("DocumentTypeOptions");

  const completedCount = route.steps.filter((s) => s.status === "done").length;
  const currentLabel = route.currentStep
    ? routeStepLabel(route.currentStep, { stepTypes, stepDetails, documentTypes: (key) => documentTypes(key) })
    : null;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-900">{typeT(route.type)}</h2>
          <p className="text-sm text-zinc-500">{descT(route.type)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {t("stepsCompleted", { done: completedCount, total: route.steps.length })}
        </span>
      </div>

      <RouteComparisonStats comparison={route.comparison} compact />

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

      <Link
        href={`/routes/${route.type}${hrefQuery}`}
        className="mt-1 inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        {t("viewFullMap")}
      </Link>
    </div>
  );
}
