import { buildRouteContext } from "./context";
import { computeGapAnalysis } from "./gapAnalysis";
import { policyFor } from "./routePolicies";
import { buildSteps } from "./steps";
import { buildReasons } from "./reasons";
import { computeComparison } from "./compare";
import { computeScorecard } from "./routeScorecard";
import { computeWorkload } from "./workloadEstimator";
import { checkCapacity } from "./capacityCheck";
import { computeFeasibilityLevel } from "./feasibilityLevel";
import { computeBottlenecks } from "./bottleneckAnalysis";
import { computeConfidence } from "./confidence";
import { computeScenarios } from "./scenarioSimulation";
import { computePortfolioStrategy } from "./applicationPortfolio";
import { selectUniversityCandidates } from "./routeUniversitySelector";
import { computeRecommendation } from "./routeRecommendation";
import { ROUTE_TYPES, type Route, type RouteEngineInput, type RouteRecommendation, type RouteType } from "./types";

/** The single entry point every page/component uses to compute a Route --
 * never re-implement step logic in a component (task brief item 17). Pure
 * function of `input` (see app/lib/data/routes.ts for how that's assembled
 * from Supabase), so it's naturally re-evaluated on every request: a
 * completed task, a new application, or a changed deadline is reflected the
 * next time this runs, with no separate "recalculate" step required (task
 * brief item 10/11). Route = Policy (task brief item 1): every route is
 * `buildSteps`/`buildReasons`/`computeComparison` applied to the exact same
 * real data (`ctx`, `gap`) with a different `RoutePolicy` -- never a
 * hand-written, one-off step list per route. */
export function generateRoute(input: RouteEngineInput, type: RouteType): Route {
  const ctx = buildRouteContext(input);
  const gap = computeGapAnalysis(ctx);
  const policy = policyFor(type, input.scholarshipNeed);
  const steps = buildSteps(ctx, policy, gap);
  const reasons = buildReasons(ctx, policy, gap, type);
  const comparison = computeComparison(ctx, policy, gap, steps);
  const currentStep = steps.find((s) => s.status === "current") ?? null;

  // Route Decision Engine v2 -- every value below is a pure function of the
  // exact same ctx/policy/gap/comparison every v1 field already uses (see
  // each module's own doc comment for the real fields it reads).
  const workload = computeWorkload(ctx, policy, gap);
  const capacity = checkCapacity(workload, input.profile.weekly_study_hours_available);
  const feasibilityLevel = computeFeasibilityLevel(comparison.feasibility, capacity);
  const bottlenecks = computeBottlenecks(ctx, policy, gap, comparison.feasibility, capacity);
  const confidence = computeConfidence(ctx);
  const scenarios = computeScenarios(ctx, policy, gap, capacity);
  const portfolio = computePortfolioStrategy(ctx, policy);
  const recommendedCandidates = selectUniversityCandidates(ctx, policy, type);

  return {
    type,
    steps,
    currentStep,
    reasons,
    comparison,
    scopedUniversityName: ctx.scopedUniversityName,
    scorecard: computeScorecard(ctx, policy, gap, comparison, workload, feasibilityLevel, confidence),
    workload,
    capacity,
    feasibilityLevel,
    bottlenecks,
    confidence,
    scenarios,
    portfolio,
    recommendedCandidates,
  };
}

export function generateAllRoutes(input: RouteEngineInput): Record<RouteType, Route> {
  const entries = ROUTE_TYPES.map((type) => [type, generateRoute(input, type)] as const);
  return Object.fromEntries(entries) as Record<RouteType, Route>;
}

/** Task brief item 15: the single Recommended route across all 5, computed
 * once every route has its own Feasibility/Capacity/Confidence -- must be
 * called with the output of `generateAllRoutes`, never a single Route.
 * `scholarshipNeed` should be the same `RouteEngineInput.scholarshipNeed`
 * used to generate those routes. */
export function recommendRoute(routes: Record<RouteType, Route>, scholarshipNeed: boolean): RouteRecommendation {
  return computeRecommendation(routes, scholarshipNeed);
}
