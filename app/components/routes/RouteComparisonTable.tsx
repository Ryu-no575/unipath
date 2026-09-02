import { useFormatter, useTranslations } from "next-intl";
import type { RouteComparisonRow } from "@/app/lib/routes/routeComparatorTable";

function Cell({ value }: { value: string }) {
  return <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">{value}</td>;
}

/** Task brief item 14: Compare Routes -- one column per route, every cell
 * pulled straight from that route's own Scorecard (already computed from
 * this specific user's real data, see routeComparatorTable.ts), never a
 * static reference table.
 *
 * A wide multi-column table can't be shrunk to fit 375px without becoming
 * unreadable, so below `sm` this renders as one stacked card per route
 * instead (same rows, dimension label above value) -- the table itself only
 * ever appears at `sm` and up, inside its own horizontal scroller as a
 * fallback for very cramped viewports. */
export default function RouteComparisonTable({ rows }: { rows: RouteComparisonRow[] }) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const levelT = useTranslations("RouteQualLevelOptions");
  const format = useFormatter();

  const level = (v: RouteComparisonRow["studyLoad"]) => (v == null ? t("unknown") : levelT(v));

  const dimensions: { label: string; value: (row: RouteComparisonRow) => string }[] = [
    {
      label: t("compareStart"),
      value: (row) => (row.startsDate ? format.dateTime(new Date(row.startsDate), "long") : t("startsNow")),
    },
    { label: t("compareStudyLoad"), value: (row) => level(row.studyLoad) },
    { label: t("compareBuffer"), value: (row) => level(row.deadlineBuffer) },
    { label: t("compareScholarships"), value: (row) => level(row.scholarshipEffort) },
    { label: t("comparePortfolioWork"), value: (row) => level(row.portfolioWork) },
    { label: t("compareBackups"), value: (row) => level(row.backupStrength) },
    { label: t("compareCostFocus"), value: (row) => level(row.costFocus) },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.type} className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">{typeT(row.type)}</h3>
            <dl className="mt-3 flex flex-col divide-y divide-zinc-100">
              {dimensions.map((dim) => (
                <div key={dim.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <dt className="text-zinc-500">{dim.label}</dt>
                  <dd className="text-right font-medium text-zinc-900">{dim.value(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("compareDimension")}
              </th>
              {rows.map((row) => (
                <th key={row.type} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {typeT(row.type)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {dimensions.map((dim) => (
              <tr key={dim.label}>
                <Cell value={dim.label} />
                {rows.map((row) => (
                  <Cell key={row.type} value={dim.value(row)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
