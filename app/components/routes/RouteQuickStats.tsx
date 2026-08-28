import { useFormatter, useTranslations } from "next-intl";
import type { RouteComparison, RouteRiskLevel, RouteType, StudyIntensity } from "@/app/lib/routes/types";

const RISK_CLASSES: Record<RouteRiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

const STUDY_CLASSES: Record<StudyIntensity, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

/** The "at a glance" difference a route card must show the moment you look
 * at it -- task brief item 19: Starts / Preparation load / Risk / Extra
 * study / Key focus. Every route already generates all five fields for
 * free (comparison.*), so nothing here is route-type-specific beyond the
 * static "Key focus" copy per RouteType. */
export default function RouteQuickStats({
  routeType,
  comparison,
}: {
  routeType: RouteType;
  comparison: RouteComparison;
}) {
  const t = useTranslations("Routes");
  const riskT = useTranslations("RouteRiskOptions");
  const prepT = useTranslations("RoutePrepLoadOptions");
  const studyT = useTranslations("RouteStudyIntensityOptions");
  const focusT = useTranslations("RouteKeyFocusOptions");
  const format = useFormatter();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Stat label={t("starts")}>
        <span className="text-sm font-medium text-zinc-900">
          {comparison.startsDate ? format.dateTime(new Date(comparison.startsDate), "long") : t("startsNow")}
        </span>
      </Stat>
      <Stat label={t("preparationLoad")}>
        <span className="text-sm font-medium text-zinc-900">{prepT(comparison.preparationLoad)}</span>
      </Stat>
      <Stat label={t("risk")}>
        <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${RISK_CLASSES[comparison.risk]}`}>
          {riskT(comparison.risk)}
        </span>
      </Stat>
      <Stat label={t("extraStudy")}>
        <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STUDY_CLASSES[comparison.extraStudy]}`}>
          {studyT(comparison.extraStudy)}
        </span>
      </Stat>
      <Stat label={t("keyFocus")}>
        <span className="text-sm font-medium text-zinc-900">{focusT(routeType)}</span>
      </Stat>
    </div>
  );
}
