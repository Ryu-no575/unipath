import { useTranslations } from "next-intl";
import type { RouteWorkload as RouteWorkloadType } from "@/app/lib/routes/types";

/** Task brief item 6: "Recommended weekly effort" -- always labeled as an
 * estimate (this app has no logged Schedule data to report an actual
 * figure from), and omits any category this route doesn't actually need
 * rather than showing a misleading "0h/week" row. */
export default function RouteWorkload({ workload }: { workload: RouteWorkloadType }) {
  const t = useTranslations("Routes");

  const rows: { key: string; label: string; hours: number }[] = [
    ...(workload.english ? [{ key: "english", label: t("workloadEnglish"), hours: workload.english.hoursPerWeek }] : []),
    ...(workload.portfolio ? [{ key: "portfolio", label: t("workloadPortfolio"), hours: workload.portfolio.hoursPerWeek }] : []),
    ...(workload.entranceExam
      ? [{ key: "entranceExam", label: t("workloadEntranceExam"), hours: workload.entranceExam.hoursPerWeek }]
      : []),
    ...(workload.documents ? [{ key: "documents", label: t("workloadDocuments"), hours: workload.documents.hoursPerWeek }] : []),
  ];

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{t("workloadNone")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-400">{t("workloadEstimateNotice")}</p>
      <div className="flex flex-col divide-y divide-zinc-100">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between py-2 text-sm">
            <span className="text-zinc-700">{row.label}</span>
            <span className="font-medium text-zinc-900">{t("hoursPerWeek", { hours: row.hours })}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm font-semibold text-zinc-900">
        <span>{t("workloadTotal")}</span>
        <span>{t("hoursPerWeek", { hours: workload.totalHoursPerWeek })}</span>
      </div>
    </div>
  );
}
