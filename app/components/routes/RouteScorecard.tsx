import { useTranslations } from "next-intl";
import type { RouteScorecard as RouteScorecardType, ScorecardDimension } from "@/app/lib/routes/types";

const DIMENSIONS: ScorecardDimension[] = [
  "time",
  "cost",
  "preparationLoad",
  "academicImprovement",
  "deadlineBuffer",
  "applicationCoverage",
  "scholarshipEffort",
  "documentWorkload",
  "portfolioWorkload",
  "examWorkload",
  "backupStrength",
  "flexibility",
  "dataConfidence",
  "feasibility",
];

const BAR_SEGMENTS = 10;

/** Task brief item 3: the Scorecard -- one bar per comparison dimension,
 * every score computed in routeScorecard.ts from this route's own real
 * Policy/GapAnalysis/Comparison/Workload numbers, never a decorative value.
 * A null score (no verified deadline yet, etc.) renders "Unknown" instead of
 * an empty/zero bar, so it's never mistaken for "scored 0". */
export default function RouteScorecard({ scorecard }: { scorecard: RouteScorecardType }) {
  const t = useTranslations("Routes");
  const dimT = useTranslations("RouteScorecardDimensions");

  return (
    <div className="flex flex-col gap-3">
      {DIMENSIONS.map((dim) => {
        const score = scorecard[dim];
        return (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">{dimT(dim)}</span>
            {score == null ? (
              <span className="text-sm text-zinc-400">{t("unknown")}</span>
            ) : (
              <>
                <div className="flex h-2 flex-1 gap-0.5" aria-hidden>
                  {Array.from({ length: BAR_SEGMENTS }, (_, i) => (
                    <span
                      key={i}
                      className={`h-full flex-1 rounded-sm ${i < score ? "bg-zinc-900" : "bg-zinc-100"}`}
                    />
                  ))}
                </div>
                <span className="w-12 shrink-0 text-right text-xs font-semibold text-zinc-700">{score} / 10</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
