import type { RouteContext } from "./context";
import type { RouteStepParams } from "./steps";
import type { RouteReason, RouteType } from "./types";

function monthsUntil(todayIso: string, targetIso: string): number {
  const today = new Date(todayIso);
  const target = new Date(targetIso);
  const days = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(days / 30));
}

/** Every reason cites a real, already-computed number from RouteContext --
 * never freeform text. This is what keeps "Why this route?" from being a
 * black box (task brief item 12): each bullet traces back to a specific
 * field the caller can also see rendered elsewhere on the page. */
export function buildReasons(ctx: RouteContext, params: RouteStepParams, routeType: RouteType): RouteReason[] {
  const reasons: RouteReason[] = [];

  if (ctx.reachEnglishTarget != null && ctx.englishScore != null && ctx.englishScore < ctx.reachEnglishTarget) {
    reasons.push({ kind: "english_gap", params: { current: ctx.englishScore, target: ctx.reachEnglishTarget } });
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
    reasons.push({ kind: "shortlist_target", params: { count: ctx.shortlistCount, target: params.shortlistTarget } });
  }

  if (!ctx.input.profile.onboarding_completed) {
    reasons.push({ kind: "profile_incomplete" });
  }

  if (params.includeScholarshipStep) {
    reasons.push({ kind: ctx.input.scholarshipNeed ? "scholarship_signal" : "scholarship_prioritized" });
  }

  if (routeType === "budget") reasons.push({ kind: "budget_focus" });
  if (routeType === "safest") reasons.push({ kind: "safety_focus" });
  if (routeType === "ambitious" && ctx.eligibilityCounts.reach > 0) {
    reasons.push({ kind: "reach_included", params: { count: ctx.eligibilityCounts.reach } });
  }
  if (routeType === "fastest") reasons.push({ kind: "fast_track" });

  return reasons.slice(0, 5);
}
