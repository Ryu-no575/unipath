import type { RouteContext } from "./context";
import type { GapAnalysis } from "./gapAnalysis";
import type { RoutePolicy } from "./routePolicies";
import { assessFeasibility } from "./backwardPlanner";
import { effectiveSequencingDate } from "./dateConfidence";
import type { RouteComparison, RoutePrepLoad, RouteRiskLevel, RouteStep, StudyIntensity } from "./types";

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

/** Risk is a structural property of the route's own strategy (shortlist
 * size, buffer, risk tolerance) plus, when real classifiable requirement
 * data exists, whether the shortlist actually includes any safety-tier
 * options. Explicitly NOT an admission-probability estimate (task brief
 * item 13/15); the UI always renders the disclaimer alongside this value. */
function computeRisk(ctx: RouteContext, policy: RoutePolicy): RouteRiskLevel {
  let score = 0;
  if (policy.shortlistTarget <= 3) score += 2;
  else if (policy.shortlistTarget <= 5) score += 1;

  if (policy.riskTolerance === "high") score += 1;
  if (policy.riskTolerance === "low") score -= 1;

  if (policy.bufferDays <= 5) score += 1;
  if (policy.bufferDays >= 20) score -= 1;

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

function computeExtraStudy(policy: RoutePolicy, gap: GapAnalysis): StudyIntensity {
  if (policy.studyIntensity === "high") return "high";
  if (policy.studyIntensity === "low" && !gap.english.hasGap && !gap.entranceExam.required) return "low";
  return policy.studyIntensity;
}

/** Earliest not-yet-done, dated step (parent or sub-step) -- task brief item
 * 19's "Starts". Null (rendered as "Now") when nothing on the route has a
 * suggested date yet. */
function computeStartsDate(steps: RouteStep[]): string | null {
  let earliest: string | null = null;
  for (const step of steps) {
    if (step.status === "done") continue;
    const candidates = [effectiveSequencingDate(step.date), ...step.subSteps.map((s) => effectiveSequencingDate(s.date))].filter(
      (d): d is string => Boolean(d),
    );
    for (const iso of candidates) {
      if (earliest == null || iso < earliest) earliest = iso;
    }
  }
  return earliest;
}

/** The minimum lead time (never the route's preferred, longer one) each
 * *actually required* activity needs -- feeds assessFeasibility so a route
 * is only flagged infeasible because of real mandatory work (task brief
 * item 15). */
function requiredMinimumLeadDays(policy: RoutePolicy, gap: GapAnalysis): number[] {
  const days: number[] = [policy.leadTime.application.min];
  if (gap.english.hasGap) days.push(policy.leadTime.english.min);
  if (gap.portfolio.required && !gap.portfolio.ready) days.push(policy.leadTime.portfolio.min);
  if (gap.entranceExam.required && !gap.entranceExam.ready) days.push(policy.leadTime.entranceExam.min);
  return days;
}

export function computeComparison(
  ctx: RouteContext,
  policy: RoutePolicy,
  gap: GapAnalysis,
  steps: RouteStep[],
): RouteComparison {
  return {
    estimatedDurationMonths: ctx.earliestDeadline ? monthsUntil(ctx.input.today, ctx.earliestDeadline.date) : null,
    estimatedCost: estimateCost(ctx),
    risk: computeRisk(ctx, policy),
    preparationLoad: computePreparationLoad(steps),
    extraStudy: computeExtraStudy(policy, gap),
    startsDate: computeStartsDate(steps),
    feasibility: assessFeasibility({
      today: ctx.input.today,
      deadlineISO: ctx.earliestDeadline?.date ?? null,
      requiredMinimumLeadDays: requiredMinimumLeadDays(policy, gap),
    }),
  };
}
