import type { RouteContext } from "./context";
import type { GapAnalysis } from "./gapAnalysis";
import type { RoutePolicy } from "./routePolicies";
import type {
  FeasibilityLevel,
  RouteComparison,
  RouteConfidence,
  RouteScorecard,
  RouteWorkload,
} from "./types";

function clamp10(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

const FEASIBILITY_SCORE: Record<FeasibilityLevel, number | null> = {
  comfortable: 10,
  feasible: 8,
  tight: 5,
  very_tight: 2,
  not_feasible: 0,
  unknown_deadline: null,
};

const CONFIDENCE_SCORE = { high: 9, medium: 5, low: 2 } as const;

/** Task brief item 1/3: scores every route on the same 14 comparison
 * dimensions, each a deterministic function of real, already-computed
 * fields (RouteContext/GapAnalysis/RoutePolicy/RouteComparison/RouteWorkload
 * -- see the doc comment on each dimension below). Never a hand-tuned
 * per-university number, and never admission probability. A dimension is
 * null only when the underlying real data doesn't exist yet (e.g. no
 * verified deadline at all), matching FEASIBILITY_SCORE.unknown_deadline. */
export function computeScorecard(
  ctx: RouteContext,
  policy: RoutePolicy,
  gap: GapAnalysis,
  comparison: RouteComparison,
  workload: RouteWorkload,
  feasibilityLevel: FeasibilityLevel,
  confidence: RouteConfidence,
): RouteScorecard {
  // Time: how many months of runway this route's own plan spans -- longer
  // plans (Ambitious) score higher, not "better", just "more time invested".
  const time = comparison.estimatedDurationMonths != null ? clamp10((comparison.estimatedDurationMonths / 12) * 10) : null;

  // Cost / financial pressure: from known tuition when available, otherwise
  // from how cost-conscious this route's own policy is (a low-sensitivity
  // route doesn't optimize cost, so real pressure is more likely to bite).
  const cost =
    comparison.estimatedCost != null
      ? clamp10((comparison.estimatedCost.amount / 40000) * 10)
      : policy.budgetSensitivity === "high"
        ? 3
        : policy.budgetSensitivity === "medium"
          ? 5
          : 8;

  const preparationLoad =
    comparison.preparationLoad === "high" ? 9 : comparison.preparationLoad === "medium" ? 5 : 2;

  const academicImprovement = policy.steps.academicImprovement && gap.reachCount > 0 ? 8 : 0;

  // Deadline buffer: this route's own buffer-day policy, normalized against
  // Safest's own maximum (30 days) as the top of the real observed range.
  const deadlineBuffer = clamp10((policy.bufferDays / 30) * 10);

  const applicationCoverage = clamp10((policy.shortlistTarget / 8) * 10);

  const scholarshipEffort =
    policy.scholarshipPriority === "high" ? 9 : policy.scholarshipPriority === "medium" ? 5 : policy.steps.scholarshipStep ? 4 : 1;

  const documentWorkload = workload.documents != null ? clamp10((workload.documents.hoursPerWeek / 3) * 10) : 0;
  const portfolioWorkload = workload.portfolio != null ? clamp10((workload.portfolio.hoursPerWeek / 7) * 10) : 0;
  const examWorkload = workload.entranceExam != null ? clamp10((workload.entranceExam.hoursPerWeek / 4) * 10) : 0;

  // Backup / fallback strength: real backup-oriented steps this policy turns
  // on, plus how many of the user's actual shortlisted programs are
  // real safety-tier options (task brief item 1: never admission probability).
  const backupStrength = clamp10(
    (policy.steps.backupUniversities ? 3 : 0) +
      (policy.steps.backupVisa ? 2 : 0) +
      (policy.steps.multipleHousing ? 2 : 0) +
      Math.min(3, ctx.eligibilityCounts.safety),
  );

  // Flexibility: how much room this route's own schedule leaves to adapt --
  // low aggressiveness (starts closer to the latest feasible date range) plus
  // a real buffer-day allowance.
  const flexibility = clamp10((1 - policy.aggressiveness) * 6 + (policy.bufferDays / 30) * 4);

  const dataConfidence = CONFIDENCE_SCORE[confidence.level];

  const feasibility = FEASIBILITY_SCORE[feasibilityLevel];

  return {
    time,
    cost: clamp10(cost),
    preparationLoad,
    academicImprovement,
    deadlineBuffer,
    applicationCoverage,
    scholarshipEffort,
    documentWorkload,
    portfolioWorkload,
    examWorkload,
    backupStrength,
    flexibility,
    dataConfidence,
    feasibility,
  };
}
