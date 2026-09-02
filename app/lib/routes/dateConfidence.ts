import { makeRouteStepDate } from "./backwardPlanner";
import type { DateSourceInfo, RouteStepDate } from "./types";

/** For call sites that only need *a* real instant to sort or place a date by
 * (Calendar sync, the Route comparison "Starts" stat, the route-diff "starts
 * earlier/later" check) -- prefers a precise suggestedDate, falls back to an
 * estimated window's start. Never used for display (that must go through
 * DateTrustBadge/formatEstimatedWindow so the estimate reads as an estimate). */
export function effectiveSequencingDate(date: RouteStepDate | null | undefined): string | null {
  return date?.suggestedDate ?? date?.estimatedWindow?.startISO ?? null;
}

/** Shared helpers for the Date Engine v2 domain modules (visaDates.ts,
 * housingDates.ts, travelDates.ts, arrivalDates.ts) -- every domain needs the
 * same "no real anchor yet" / "range, not a point" / "shift by N days"
 * primitives, but must never share Application's application-deadline-based
 * backwardPlanner.planBackwardDate (that reuse was task brief PART B's core
 * bug: see steps.ts's old buildTaskDrivenStep). */

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

export function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7);
}

/** Never plan into the past -- mirrors backwardPlanner.planBackwardDate's own
 * clamp so every domain degrades the same way once a window has already
 * elapsed. */
export function clampToToday(iso: string, today: string): string {
  return new Date(iso).getTime() < new Date(today).getTime() ? new Date(today).toISOString() : iso;
}

/** Linear interpolation between two ISO instants by `t` in [0, 1]. */
export function interpolateBetween(startISO: string, endISO: string, t: number): string {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const clampedT = Math.max(0, Math.min(1, t));
  return new Date(start + (end - start) * clampedT).toISOString();
}

/** "Nothing real to compute from yet" -- renders as "Being verified" (task
 * brief item 4/6), never a fabricated value. */
export function unverifiedDate(): RouteStepDate {
  return makeRouteStepDate({});
}

/** A bounded window computed from real (if imperfect) official data --
 * confidence "estimated_window" (task item 3/17: a range, never a fake exact
 * date). */
export function estimatedWindowDate(params: {
  startISO: string;
  endISO: string;
  officialSource?: DateSourceInfo | null;
}): RouteStepDate {
  return makeRouteStepDate({
    estimatedWindow: { startISO: params.startISO, endISO: params.endISO, qualitativeLabel: null },
    officialSource: params.officialSource ?? null,
  });
}

/** A qualitative-only estimate ("Early March", "2-6 weeks") -- used when even
 * a bounded window would be false precision. */
export function qualitativeWindowDate(label: string, officialSource?: DateSourceInfo | null): RouteStepDate {
  return makeRouteStepDate({
    estimatedWindow: { startISO: null, endISO: null, qualitativeLabel: label },
    officialSource: officialSource ?? null,
  });
}
