import type { RouteContext } from "./context";
import type { GapAnalysis } from "./gapAnalysis";
import type { RoutePolicy } from "./routePolicies";
import { assessFeasibility } from "./backwardPlanner";
import type { RouteReason, RouteType } from "./types";

function monthsUntil(todayIso: string, targetIso: string): number {
  const today = new Date(todayIso);
  const target = new Date(targetIso);
  const days = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(days / 30));
}

/** Every reason cites a real, already-computed number from RouteContext,
 * GapAnalysis, or this route's own Policy -- never freeform text. This is
 * what keeps "Why this route?" from being a black box (task brief item 12):
 * each bullet traces back to a specific field the caller can also see
 * rendered elsewhere on the page. */
export function buildReasons(
  ctx: RouteContext,
  policy: RoutePolicy,
  gap: GapAnalysis,
  routeType: RouteType,
): RouteReason[] {
  const reasons: RouteReason[] = [];

  const feasibility = assessFeasibility({
    today: ctx.input.today,
    deadlineISO: ctx.earliestDeadline?.date ?? null,
    requiredMinimumLeadDays: [
      policy.leadTime.application.min,
      ...(gap.english.hasGap ? [policy.leadTime.english.min] : []),
      ...(gap.portfolio.required && !gap.portfolio.ready ? [policy.leadTime.portfolio.min] : []),
      ...(gap.entranceExam.required && !gap.entranceExam.ready ? [policy.leadTime.entranceExam.min] : []),
    ],
  });
  if (feasibility.status === "infeasible") {
    reasons.push({ kind: "feasibility_infeasible" });
  } else if (feasibility.status === "tight") {
    reasons.push({ kind: "feasibility_tight" });
  }

  if (gap.english.hasGap) {
    reasons.push({ kind: "english_gap", params: { current: gap.english.current!, target: gap.english.target! } });
  } else if (ctx.hasEnglishSignal) {
    reasons.push({ kind: "english_met" });
  }

  if (ctx.earliestDeadline) {
    reasons.push({ kind: "deadline_in_months", params: { months: monthsUntil(ctx.input.today, ctx.earliestDeadline.date) } });
  } else if (!ctx.isTargetMode && ctx.shortlistCount > 0) {
    reasons.push({ kind: "no_known_deadline" });
  }

  if (ctx.readinessAvgPercent != null) {
    reasons.push({ kind: "documents_ready_percent", params: { percent: ctx.readinessAvgPercent } });
  }

  if (!ctx.isTargetMode) {
    reasons.push({ kind: "shortlist_target", params: { count: ctx.shortlistCount, target: policy.shortlistTarget } });
  }

  if (!ctx.input.profile.onboarding_completed) {
    reasons.push({ kind: "profile_incomplete" });
  }

  if (policy.steps.budgetSteps) {
    reasons.push({ kind: ctx.input.scholarshipNeed ? "scholarship_signal" : "scholarship_prioritized" });
    reasons.push({ kind: "budget_focus" });
  } else if (policy.steps.scholarshipStep) {
    reasons.push({ kind: ctx.input.scholarshipNeed ? "scholarship_signal" : "scholarship_prioritized" });
  }

  if (routeType === "safest") {
    reasons.push({ kind: "safety_focus" });
    reasons.push({ kind: "large_buffer", params: { days: policy.bufferDays } });
  }

  if (policy.steps.academicImprovement && gap.reachCount > 0) {
    reasons.push({ kind: "academic_improvement_reach", params: { count: gap.reachCount } });
  }
  if (routeType === "ambitious" && ctx.eligibilityCounts.reach > 0) {
    reasons.push({ kind: "reach_included", params: { count: ctx.eligibilityCounts.reach } });
  }
  if (policy.portfolioIterations >= 2 && gap.portfolio.required) {
    reasons.push({ kind: "portfolio_iterations", params: { count: policy.portfolioIterations } });
  }
  if (policy.steps.entranceExamPrepPlan && gap.entranceExam.required) {
    reasons.push({ kind: "entrance_exam_prep" });
  }

  if (routeType === "fastest") reasons.push({ kind: "fast_track" });

  return reasons.slice(0, 6);
}
