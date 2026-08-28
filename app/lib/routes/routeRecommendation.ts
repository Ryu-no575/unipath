import type { FeasibilityLevel, Route, RouteReason, RouteRecommendation, RouteType } from "./types";
import { DEFAULT_ROUTE_TYPE } from "./activeRoute";

const FEASIBILITY_RANK: Record<FeasibilityLevel, number> = {
  comfortable: 4,
  feasible: 3,
  tight: 2,
  very_tight: 1,
  not_feasible: 0,
  unknown_deadline: 2,
};

const CONFIDENCE_RANK = { high: 2, medium: 1, low: 0 } as const;
const CAPACITY_SCORE = { ok: 2, unknown: 0, mismatch: -3 } as const;

/** Scores one route for recommendation purposes. Beyond
 * feasibility/capacity/confidence (which any route can win), two real,
 * per-user signals break ties between routes that otherwise land on
 * identical numbers (a single, already-eligible application scores every
 * route the same on those three alone): `academicImprovement` is nonzero
 * only when this route's own policy targets a real reach opportunity the
 * user's data actually has (routeScorecard.ts), and `scholarshipEffort`
 * only counts when the user has a real declared scholarship need. A small
 * preparationLoad penalty then prefers the least-demanding route when nothing
 * else differs (e.g. every route is equally infeasible against a very close
 * deadline) -- Fastest structurally has the lowest load, so this is what
 * keeps a hopeless case from defaulting to Balanced by tie-break alone. */
function score(route: Route, scholarshipNeed: boolean): number {
  // Pursuing a reach opportunity or an extra scholarship push only makes
  // sense when this route is at least "tight" (real runway exists) --
  // never let those bonuses promote a route that's already very_tight or
  // not_feasible above one that at least fits the calendar.
  const hasRunway = FEASIBILITY_RANK[route.feasibilityLevel] >= 2;
  const academicBonus = hasRunway ? (route.scorecard.academicImprovement ?? 0) / 4 : 0;
  const scholarshipBonus = hasRunway && scholarshipNeed ? (route.scorecard.scholarshipEffort ?? 0) / 4 : 0;
  const prepLoadPenalty = (route.scorecard.preparationLoad ?? 0) / 3;
  const tieBreak = route.type === DEFAULT_ROUTE_TYPE ? 0.5 : 0;

  return (
    FEASIBILITY_RANK[route.feasibilityLevel] * 3 +
    CAPACITY_SCORE[route.capacity.status] +
    CONFIDENCE_RANK[route.confidence.level] +
    academicBonus +
    scholarshipBonus -
    prepLoadPenalty +
    tieBreak
  );
}

/** Task brief item 15: picks one Route to surface as "Recommended", scored
 * purely from fields every route already computes (FeasibilityLevel,
 * Capacity, Confidence, Scorecard) plus the user's own real declared
 * scholarship need -- never admission probability, never a hand-picked
 * default. The user can always pick a different route (task brief item 15's
 * explicit requirement); this only changes which card shows the badge. */
export function computeRecommendation(routes: Record<RouteType, Route>, scholarshipNeed: boolean): RouteRecommendation {
  const entries = Object.values(routes);
  const best = entries.reduce((a, b) => (score(b, scholarshipNeed) > score(a, scholarshipNeed) ? b : a));

  const bestFeasibilityRank = Math.max(...entries.map((r) => FEASIBILITY_RANK[r.feasibilityLevel]));
  const higherPrepCount = entries.filter(
    (r) => r.type !== best.type && (r.scorecard.preparationLoad ?? 0) > (best.scorecard.preparationLoad ?? 0),
  ).length;
  const mismatchedElsewhereCount = entries.filter((r) => r.type !== best.type && r.capacity.status === "mismatch").length;

  const reasons: RouteReason[] = [];
  if (FEASIBILITY_RANK[best.feasibilityLevel] >= bestFeasibilityRank) {
    reasons.push({ kind: "best_feasibility" });
  }
  if (best.capacity.status === "ok") {
    reasons.push({ kind: "capacity_fits" });
  } else if (mismatchedElsewhereCount > 0 && best.capacity.status !== "mismatch") {
    reasons.push({ kind: "capacity_exceeded", params: { count: mismatchedElsewhereCount } });
  }
  if (best.type === "budget" && best.recommendedCandidates.length > 0) {
    reasons.push({ kind: "budget_compatible_count", params: { count: best.recommendedCandidates.length } });
  }
  if (higherPrepCount > 0) {
    reasons.push({ kind: "lower_prep_than_alternative", params: { count: higherPrepCount } });
  }
  if (best.portfolio.core.count + best.portfolio.backup.count > 0 && (best.scorecard.feasibility ?? 0) >= 8) {
    reasons.push({ kind: "time_sufficient_iterations" });
  }

  return { recommendedType: best.type, reasons: reasons.slice(0, 4) };
}
