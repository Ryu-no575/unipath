import { useFormatter, useTranslations } from "next-intl";
import type { RouteComparisonRow } from "@/app/lib/routes/routeComparatorTable";

function Cell({ value }: { value: string }) {
  return <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">{value}</td>;
}

/** Task brief item 14: Compare Routes -- one column per route, every cell
 * pulled straight from that route's own Scorecard (already computed from
 * this specific user's real data, see routeComparatorTable.ts), never a
 * static reference table. */
export default function RouteComparisonTable({ rows }: { rows: RouteComparisonRow[] }) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const levelT = useTranslations("RouteQualLevelOptions");
  const format = useFormatter();

  const level = (v: RouteComparisonRow["studyLoad"]) => (v == null ? t("unknown") : levelT(v));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
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
          <tr>
            <Cell value={t("compareStart")} />
            {rows.map((row) => (
              <Cell key={row.type} value={row.startsDate ? format.dateTime(new Date(row.startsDate), "long") : t("startsNow")} />
            ))}
          </tr>
          <tr>
            <Cell value={t("compareStudyLoad")} />
            {rows.map((row) => (
              <Cell key={row.type} value={level(row.studyLoad)} />
            ))}
          </tr>
          <tr>
            <Cell value={t("compareBuffer")} />
            {rows.map((row) => (
              <Cell key={row.type} value={level(row.deadlineBuffer)} />
            ))}
          </tr>
          <tr>
            <Cell value={t("compareScholarships")} />
            {rows.map((row) => (
              <Cell key={row.type} value={level(row.scholarshipEffort)} />
            ))}
          </tr>
          <tr>
            <Cell value={t("comparePortfolioWork")} />
            {rows.map((row) => (
              <Cell key={row.type} value={level(row.portfolioWork)} />
            ))}
          </tr>
          <tr>
            <Cell value={t("compareBackups")} />
            {rows.map((row) => (
              <Cell key={row.type} value={level(row.backupStrength)} />
            ))}
          </tr>
          <tr>
            <Cell value={t("compareCostFocus")} />
            {rows.map((row) => (
              <Cell key={row.type} value={level(row.costFocus)} />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
