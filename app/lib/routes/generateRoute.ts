import { buildRouteContext } from "./context";
import { buildSteps, type RouteStepParams } from "./steps";
import { buildReasons } from "./reasons";
import { computeComparison } from "./compare";
import { FASTEST_PARAMS } from "./fastestRoute";
import { SAFEST_PARAMS } from "./safestRoute";
import { BUDGET_PARAMS } from "./budgetRoute";
import { AMBITIOUS_PARAMS } from "./ambitiousRoute";
import { getBalancedParams } from "./balancedRoute";
import { ROUTE_TYPES, type Route, type RouteEngineInput, type RouteType } from "./types";

function paramsFor(type: RouteType, scholarshipNeed: boolean): RouteStepParams {
  switch (type) {
    case "fastest":
      return FASTEST_PARAMS;
    case "safest":
      return SAFEST_PARAMS;
    case "budget":
      return BUDGET_PARAMS;
    case "ambitious":
      return AMBITIOUS_PARAMS;
    case "balanced":
      return getBalancedParams(scholarshipNeed);
  }
}

/** The single entry point every page/component uses to compute a Route --
 * never re-implement step logic in a component (task brief item 17). Pure
 * function of `input` (see app/lib/data/routes.ts for how that's assembled
 * from Supabase), so it's naturally re-evaluated on every request: a
 * completed task, a new application, or a changed deadline is reflected the
 * next time this runs, with no separate "recalculate" step required (task
 * brief item 11). */
export function generateRoute(input: RouteEngineInput, type: RouteType): Route {
  const ctx = buildRouteContext(input);
  const params = paramsFor(type, input.scholarshipNeed);
  const steps = buildSteps(ctx, params);
  const reasons = buildReasons(ctx, params, type);
  const comparison = computeComparison(ctx, params, steps);
  const currentStep = steps.find((s) => s.status === "current") ?? null;

  return {
    type,
    steps,
    currentStep,
    reasons,
    comparison,
    scopedUniversityName: ctx.scopedUniversityName,
  };
}

export function generateAllRoutes(input: RouteEngineInput): Record<RouteType, Route> {
  const entries = ROUTE_TYPES.map((type) => [type, generateRoute(input, type)] as const);
  return Object.fromEntries(entries) as Record<RouteType, Route>;
}
