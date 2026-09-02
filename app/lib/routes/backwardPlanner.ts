import type { LeadTimeRange } from "./routePolicies";
import type { DateConfidence, DateSourceInfo, EstimatedWindow, RouteFeasibility, RouteStepDate } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The one place RouteStepDate.confidence is derived -- every constructor in
 * this codebase (here and steps.ts) must build a date through this, never by
 * hand-rolling the official > suggested > estimated_window > unverified
 * precedence itself (task brief items 3/16/17). */
export function makeRouteStepDate(params: {
  officialDate?: string | null;
  officialTimezone?: string | null;
  officialSource?: DateSourceInfo | null;
  suggestedDate?: string | null;
  suggestedSource?: RouteStepDate["suggestedSource"];
  estimatedWindow?: EstimatedWindow | null;
}): RouteStepDate {
  const confidence: DateConfidence = params.officialDate
    ? "official"
    : params.suggestedDate
      ? "suggested"
      : params.estimatedWindow
        ? "estimated_window"
        : "unverified";
  return {
    officialDate: params.officialDate ?? null,
    officialTimezone: params.officialTimezone ?? null,
    officialSource: params.officialSource ?? null,
    suggestedDate: params.suggestedDate ?? null,
    suggestedSource: params.suggestedSource ?? null,
    estimatedWindow: params.estimatedWindow ?? null,
    confidence,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Interpolates within [range.min, range.max] by `aggressiveness` (0 = the
 * latest feasible start, at range.min; 1 = the earliest possible start, at
 * range.max). This is what makes the exact same Official Deadline produce
 * different Suggested Dates per route (task brief item 3): the range comes
 * from the activity, the position within it comes from the route's policy. */
export function interpolateLeadDays(range: LeadTimeRange, aggressiveness: number): number {
  const t = clamp01(aggressiveness);
  return Math.round(range.min + (range.max - range.min) * t);
}

/** Backward-plans a single date: deadline minus an interpolated (+ optional
 * buffer) lead time, clamped so it never lands before `today`. Returns null
 * when there's no verified deadline to plan against -- task brief item 16:
 * never invent a date from nothing. */
export function planBackwardDate(params: {
  today: string;
  deadlineISO: string | null;
  range: LeadTimeRange;
  aggressiveness: number;
  bufferDays?: number;
}): string | null {
  if (!params.deadlineISO) return null;
  const deadline = new Date(params.deadlineISO);
  if (Number.isNaN(deadline.getTime())) return null;

  const leadDays = interpolateLeadDays(params.range, params.aggressiveness) + (params.bufferDays ?? 0);
  const planned = new Date(deadline);
  planned.setUTCDate(planned.getUTCDate() - leadDays);

  const today = new Date(params.today);
  if (planned.getTime() < today.getTime()) return today.toISOString();
  return planned.toISOString();
}

/** Wraps planBackwardDate into a full RouteStepDate, matching the shape
 * every RouteStep/RouteSubStep already uses. */
export function backwardPlannedStepDate(params: {
  today: string;
  deadlineISO: string | null;
  timezone: string | null;
  officialSource?: DateSourceInfo | null;
  range: LeadTimeRange;
  aggressiveness: number;
  bufferDays?: number;
}): RouteStepDate | null {
  const suggestedDate = planBackwardDate(params);
  if (!suggestedDate) return null;
  return makeRouteStepDate({
    officialDate: params.deadlineISO,
    officialTimezone: params.timezone,
    officialSource: params.officialSource ?? null,
    suggestedDate,
    suggestedSource: "unipath",
  });
}

/** Places `count` evenly-spaced milestones between two anchor dates -- used
 * for a study plan's weekly progression or a portfolio's iteration
 * schedule (task brief item 7: "Week/Month planning", never a single
 * "Study IELTS" step). Returns `count` ISO dates, first = startISO,
 * last = endISO. */
export function planSequence(startISO: string, endISO: string, count: number): string[] {
  if (count <= 1) return [endISO];
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const span = end - start;
  return Array.from({ length: count }, (_, i) => {
    const t = start + (span * i) / (count - 1);
    return new Date(t).toISOString();
  });
}

/** Task brief item 15: don't generate an "Easy" route when the real
 * remaining runway can't fit the activities it actually requires. Compares
 * days-until-deadline against the *minimum* (not the route's preferred)
 * lead time for every activity this route's gap analysis says is actually
 * required -- so a route is only "infeasible" because of real, mandatory
 * work, never because of its own optional extras. */
export function assessFeasibility(params: {
  today: string;
  deadlineISO: string | null;
  requiredMinimumLeadDays: number[];
}): RouteFeasibility {
  if (!params.deadlineISO) {
    return { status: "unknown_deadline", daysUntilDeadline: null, minimumLeadDaysNeeded: null };
  }
  const deadline = new Date(params.deadlineISO);
  if (Number.isNaN(deadline.getTime())) {
    return { status: "unknown_deadline", daysUntilDeadline: null, minimumLeadDaysNeeded: null };
  }

  const daysUntilDeadline = Math.round((deadline.getTime() - new Date(params.today).getTime()) / MS_PER_DAY);
  const minimumLeadDaysNeeded =
    params.requiredMinimumLeadDays.length > 0 ? Math.max(...params.requiredMinimumLeadDays) : 0;

  if (daysUntilDeadline < minimumLeadDaysNeeded) {
    return { status: "infeasible", daysUntilDeadline, minimumLeadDaysNeeded };
  }
  if (daysUntilDeadline < minimumLeadDaysNeeded * 1.15) {
    return { status: "tight", daysUntilDeadline, minimumLeadDaysNeeded };
  }
  return { status: "feasible", daysUntilDeadline, minimumLeadDaysNeeded };
}
