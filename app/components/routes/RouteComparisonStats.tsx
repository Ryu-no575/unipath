import { useTranslations } from "next-intl";
import type { RouteComparison, RoutePrepLoad, RouteRiskLevel } from "@/app/lib/routes/types";

const RISK_CLASSES: Record<RouteRiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

const PREP_LOAD_CLASSES: Record<RoutePrepLoad, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

export default function RouteComparisonStats({
  comparison,
  compact = false,
}: {
  comparison: RouteComparison;
  /** Use inside a narrower card (e.g. the /routes comparison grid) so the
   * 4 stats stay legible instead of cramming onto one row. */
  compact?: boolean;
}) {
  const t = useTranslations("Routes");
  const riskT = useTranslations("RouteRiskOptions");
  const prepT = useTranslations("RoutePrepLoadOptions");

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid grid-cols-2 gap-4 ${compact ? "" : "sm:grid-cols-4"}`}>
        <Stat label={t("estimatedDuration")}>
          <span className="text-sm font-medium text-zinc-900">
            {comparison.estimatedDurationMonths != null
              ? t("months", { count: comparison.estimatedDurationMonths })
              : t("unknown")}
          </span>
        </Stat>
        <Stat label={t("estimatedCost")}>
          <span className="text-sm font-medium text-zinc-900">
            {comparison.estimatedCost
              ? `${comparison.estimatedCost.amount.toLocaleString()} ${comparison.estimatedCost.currency}`
              : t("unknown")}
          </span>
        </Stat>
        <Stat label={t("risk")}>
          <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${RISK_CLASSES[comparison.risk]}`}>
            {riskT(comparison.risk)}
          </span>
        </Stat>
        <Stat label={t("preparationLoad")}>
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${PREP_LOAD_CLASSES[comparison.preparationLoad]}`}
          >
            {prepT(comparison.preparationLoad)}
          </span>
        </Stat>
      </div>
      <p className="text-xs text-zinc-400">{t("riskDisclaimer")}</p>
    </div>
  );
}
