import type { Route, RouteType } from "./types";

export type QualLevel = "min" | "low" | "medium" | "high" | "maximum";

function levelFromScore(score: number | null): QualLevel | null {
  if (score == null) return null;
  if (score <= 1) return "min";
  if (score <= 3) return "low";
  if (score <= 6) return "medium";
  if (score <= 8) return "high";
  return "maximum";
}

export interface RouteComparisonRow {
  type: RouteType;
  startsDate: string | null; // ISO, or null meaning "Now"
  studyLoad: QualLevel | null;
  deadlineBuffer: QualLevel | null;
  scholarshipEffort: QualLevel | null;
  portfolioWork: QualLevel | null;
  backupStrength: QualLevel | null;
  costFocus: QualLevel | null;
}

/** Task brief item 14: the Compare Routes table -- one row per route, each
 * cell a QualLevel bucketed straight from that route's own Scorecard
 * (routeScorecard.ts), which is itself computed from this specific user's
 * real profile/applications/policy -- never a static, user-independent
 * table (task brief item 14: "さらにユーザー固有データを反映"). `costFocus` is
 * inverted from the `cost` (financial-pressure) dimension: a route that
 * actively optimizes cost (Budget) shows "maximum" cost focus even though
 * its financial-pressure score is low. */
export function buildComparisonRows(routes: Record<RouteType, Route>, order: RouteType[]): RouteComparisonRow[] {
  return order.map((type) => {
    const route = routes[type];
    const invertedCostFocus =
      route.scorecard.cost != null && route.scorecard.scholarshipEffort != null
        ? Math.round((10 - route.scorecard.cost) * 0.4 + route.scorecard.scholarshipEffort * 0.6)
        : null;
    return {
      type,
      startsDate: route.comparison.startsDate,
      studyLoad: levelFromScore(route.scorecard.preparationLoad),
      deadlineBuffer: levelFromScore(route.scorecard.deadlineBuffer),
      scholarshipEffort: levelFromScore(route.scorecard.scholarshipEffort),
      portfolioWork: levelFromScore(route.scorecard.portfolioWorkload),
      backupStrength: levelFromScore(route.scorecard.backupStrength),
      costFocus: levelFromScore(invertedCostFocus),
    };
  });
}
