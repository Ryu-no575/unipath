import { useTranslations } from "next-intl";
import type { Route } from "@/app/lib/routes/types";
import { routeStepLabel } from "@/app/lib/routes/labels";

/** The single "NEXT ACTION" banner shown at the top of /routes -- always
 * sourced from the user's active route (see app/lib/routes/activeRoute.ts)
 * so it agrees with Dashboard's "Your Current Route" widget and updates the
 * moment the user switches routes (task brief item 14). */
export default function RouteNextActionBanner({ route }: { route: Route }) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const stepTypes = useTranslations("RouteStepTypeOptions");
  const stepDetails = useTranslations("RouteStepDetails");
  const documentTypes = useTranslations("DocumentTypeOptions");

  if (!route.currentStep) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-blue-100 bg-blue-50 p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{t("nextActionHeading")}</h2>
        <p className="text-sm text-zinc-500">{t("allCaughtUp")}</p>
      </div>
    );
  }

  const label = routeStepLabel(route.currentStep, { stepTypes, stepDetails, documentTypes: (key) => documentTypes(key) });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 p-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{t("nextActionHeading")}</h2>
      <p className="text-lg font-semibold text-zinc-900">{label.title}</p>
      <p className="text-sm text-zinc-600">{label.detail}</p>
      <p className="text-xs text-zinc-400">{t("recommendedByLine", { route: typeT(route.type) })}</p>
    </div>
  );
}
