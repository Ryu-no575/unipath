import { useTranslations } from "next-intl";
import type { PortfolioStrategy } from "@/app/lib/routes/types";

/** Task brief item 13: Reach/Core/Backup counts among the user's *actual*
 * shortlisted applications (real EligibilityTier -- see
 * app/lib/routes/applicationPortfolio.ts), explicitly not an
 * admission-probability bucket. `target` (when this route's policy sets
 * one) is shown alongside the real count so the gap is visible. */
export default function RoutePortfolioStrategy({ portfolio }: { portfolio: PortfolioStrategy }) {
  const t = useTranslations("Routes");

  const rows: { key: string; label: string; count: number; target: number | null }[] = [
    { key: "reach", label: t("portfolioReach"), count: portfolio.reach.count, target: portfolio.reach.target },
    { key: "core", label: t("portfolioCore"), count: portfolio.core.count, target: portfolio.core.target },
    { key: "backup", label: t("portfolioBackup"), count: portfolio.backup.count, target: portfolio.backup.target },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-900">{t("portfolioHeading")}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-1 rounded-lg border border-zinc-200 px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{row.label}</span>
            <span className="text-lg font-semibold text-zinc-900">
              {row.count}
              {row.target != null && <span className="text-sm font-normal text-zinc-400"> / {row.target}</span>}
            </span>
          </div>
        ))}
      </div>
      {portfolio.unclassified > 0 && (
        <p className="text-xs text-zinc-400">{t("portfolioUnclassified", { count: portfolio.unclassified })}</p>
      )}
      <p className="text-xs text-zinc-400">{t("portfolioDisclaimer")}</p>
    </div>
  );
}
