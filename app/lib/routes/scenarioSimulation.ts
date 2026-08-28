import { assessFeasibility } from "./backwardPlanner";
import { computeFeasibilityLevel } from "./feasibilityLevel";
import type { RouteContext } from "./context";
import type { GapAnalysis } from "./gapAnalysis";
import type { RoutePolicy } from "./routePolicies";
import type { RouteCapacity, RouteScenario } from "./types";

const START_EARLIER_DAYS = 60;

/** Task brief item 11: each What-if re-runs the exact same
 * assessFeasibility() the route itself uses, under one changed, real
 * assumption -- never a freeform prediction. Only constructed when the
 * underlying condition is real (a verified deadline exists; an actual
 * English/portfolio/entrance-exam gap exists to close) and only kept when it
 * actually changes the resulting FeasibilityLevel, so every scenario shown
 * is a genuine "this would help" rather than a no-op. */
export function computeScenarios(
  ctx: RouteContext,
  policy: RoutePolicy,
  gap: GapAnalysis,
  capacity: RouteCapacity,
): RouteScenario[] {
  const deadlineISO = ctx.earliestDeadline?.date ?? null;
  if (!deadlineISO) return [];

  const baseRequired = (extra: { english?: boolean; portfolio?: boolean; entranceExam?: boolean } = {}) => {
    const days: number[] = [policy.leadTime.application.min];
    if ((extra.english ?? gap.english.hasGap)) days.push(policy.leadTime.english.min);
    if ((extra.portfolio ?? (gap.portfolio.required && !gap.portfolio.ready))) days.push(policy.leadTime.portfolio.min);
    if ((extra.entranceExam ?? (gap.entranceExam.required && !gap.entranceExam.ready))) days.push(policy.leadTime.entranceExam.min);
    return days;
  };

  const currentFeasibility = assessFeasibility({ today: ctx.input.today, deadlineISO, requiredMinimumLeadDays: baseRequired() });
  const currentLevel = computeFeasibilityLevel(currentFeasibility, capacity);

  const scenarios: RouteScenario[] = [];

  // Start earlier: pretend `today` is START_EARLIER_DAYS in the past, which
  // is equivalent to adding that many days to daysUntilDeadline directly.
  if (currentFeasibility.daysUntilDeadline != null) {
    const shifted = assessFeasibility({
      today: ctx.input.today,
      deadlineISO,
      requiredMinimumLeadDays: baseRequired(),
    });
    const shiftedLevel = computeFeasibilityLevel(
      { ...shifted, daysUntilDeadline: shifted.daysUntilDeadline! + START_EARLIER_DAYS },
      capacity,
    );
    if (shiftedLevel !== currentLevel) {
      scenarios.push({
        kind: "start_earlier",
        beforeLevel: currentLevel,
        afterLevel: shiftedLevel,
        params: { days: START_EARLIER_DAYS },
      });
    }
  }

  if (gap.english.hasGap) {
    const closed = assessFeasibility({
      today: ctx.input.today,
      deadlineISO,
      requiredMinimumLeadDays: baseRequired({ english: false }),
    });
    const closedLevel = computeFeasibilityLevel(closed, capacity);
    if (closedLevel !== currentLevel) {
      scenarios.push({ kind: "english_gap_closed", beforeLevel: currentLevel, afterLevel: closedLevel });
    }
  }

  if (gap.portfolio.required && !gap.portfolio.ready) {
    const ready = assessFeasibility({
      today: ctx.input.today,
      deadlineISO,
      requiredMinimumLeadDays: baseRequired({ portfolio: false }),
    });
    const readyLevel = computeFeasibilityLevel(ready, capacity);
    if (readyLevel !== currentLevel) {
      scenarios.push({ kind: "portfolio_ready", beforeLevel: currentLevel, afterLevel: readyLevel });
    }
  }

  if (gap.entranceExam.required && !gap.entranceExam.ready) {
    const ready = assessFeasibility({
      today: ctx.input.today,
      deadlineISO,
      requiredMinimumLeadDays: baseRequired({ entranceExam: false }),
    });
    const readyLevel = computeFeasibilityLevel(ready, capacity);
    if (readyLevel !== currentLevel) {
      scenarios.push({ kind: "entrance_exam_ready", beforeLevel: currentLevel, afterLevel: readyLevel });
    }
  }

  return scenarios.slice(0, 3);
}
