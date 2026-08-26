import type { RouteContext } from "./context";
import type { RouteStepParams } from "./steps";
import type { RouteComparison, RoutePrepLoad, RouteRiskLevel, RouteStep } from "./types";

function monthsUntil(todayIso: string, targetIso: string): number {
  const today = new Date(todayIso);
  const target = new Date(targetIso);
  const days = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(days / 30));
}

function estimateCost(ctx: RouteContext): { amount: number; currency: string } | null {
  if (ctx.scope.length === 0) return null;
  const known = ctx.scope.map((s) =>
    s.tuitionAmount != null && s.tuitionCurrency ? { amount: s.tuitionAmount, currency: s.tuitionCurrency } : null,
  );
  if (known.some((t) => t == null)) return null;
  const currencies = new Set(known.map((t) => t!.currency));
  if (currencies.size !== 1) return null;
  return { amount: known.reduce((sum, t) => sum + t!.amount, 0), currency: [...currencies][0] };
}

/** Risk is a structural property of the route's own strategy (how many
 * backup options it targets, how much preparation buffer it leaves) plus,
 * when real classifiable requirement data exists, whether the shortlist
 * actually includes any safety-tier options. It is explicitly NOT an
 * admission-probability estimate -- see task brief item 13; the UI must
 * always render the disclaimer alongside this value. */
function computeRisk(ctx: RouteContext, params: RouteStepParams): RouteRiskLevel {
  let score = 0;
  if (params.shortlistTarget <= 3) score += 2;
  else if (params.shortlistTarget <= 5) score += 1;

  if (params.suggestedLeadDays <= 5) score += 2;
  else if (params.suggestedLeadDays <= 14) score += 1;

  if (!ctx.isTargetMode && ctx.shortlistCount > 0) {
    if (ctx.eligibilityCounts.reach > 0 && ctx.eligibilityCounts.safety === 0) score += 1;
    if (ctx.eligibilityCounts.safety > 0 && ctx.eligibilityCounts.reach === 0) score -= 1;
  }

  if (score >= 3) return "high";
  if (score <= 0) return "low";
  return "medium";
}

function computePreparationLoad(steps: RouteStep[]): RoutePrepLoad {
  const remaining = steps.filter((s) => s.status !== "done").length;
  if (remaining <= 3) return "low";
  if (remaining <= 6) return "medium";
  return "high";
}

export function computeComparison(ctx: RouteContext, params: RouteStepParams, steps: RouteStep[]): RouteComparison {
  return {
    estimatedDurationMonths: ctx.earliestDeadline ? monthsUntil(ctx.input.today, ctx.earliestDeadline.date) : null,
    estimatedCost: estimateCost(ctx),
    risk: computeRisk(ctx, params),
    preparationLoad: computePreparationLoad(steps),
  };
}
