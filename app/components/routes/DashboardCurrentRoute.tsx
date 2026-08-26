import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Route } from "@/app/lib/routes/types";
import { routeStepLabel } from "@/app/lib/routes/labels";

/** Dashboard's small "Your Current Route" widget (task brief item 15) --
 * always the Balanced route, so its Next step matches /routes' own top
 * banner exactly (both call the same app/lib/routes/generateRoute.ts).
 * Must render below NextActionCard, never above it. */
export default function DashboardCurrentRoute({ route }: { route: Route }) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const stepTypes = useTranslations("RouteStepTypeOptions");
  const stepDetails = useTranslations("RouteStepDetails");
  const documentTypes = useTranslations("DocumentTypeOptions");

  const completedCount = route.steps.filter((s) => s.status === "done").length;
  const currentLabel = route.currentStep
    ? routeStepLabel(route.currentStep, { stepTypes, stepDetails, documentTypes: (key) => documentTypes(key) })
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {t("routeTypeLabel", { route: typeT(route.type) })}
      </span>
      <span className="text-sm text-zinc-600">
        {t("stepsCompleted", { done: completedCount, total: route.steps.length })}
      </span>
      {currentLabel && (
        <span className="text-sm text-zinc-900">
          {t("nextLine", { step: currentLabel.title })}
        </span>
      )}
      <Link
        href={`/routes/${route.type}`}
        className="mt-1 w-fit text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
      >
        {t("viewFullRoute")}
      </Link>
    </div>
  );
}
