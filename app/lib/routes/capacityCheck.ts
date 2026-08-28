import type { RouteWorkload, RouteCapacity } from "./types";

/** Task brief item 7: compares a route's own RouteWorkload against the
 * user's optionally-declared `profiles.weekly_study_hours_available`
 * (see app/lib/actions/routes.ts:setWeeklyStudyHoursAction). "unknown" is
 * the status whenever the user hasn't set that field yet -- never assume
 * capacity is fine just because nothing was declared (task brief item 30). */
export function checkCapacity(workload: RouteWorkload, availableHoursPerWeek: number | null): RouteCapacity {
  if (availableHoursPerWeek == null) {
    return {
      status: "unknown",
      availableHoursPerWeek: null,
      requiredHoursPerWeek: workload.totalHoursPerWeek,
      deficitHoursPerWeek: null,
    };
  }

  const deficit = workload.totalHoursPerWeek - availableHoursPerWeek;
  return {
    status: deficit > 0 ? "mismatch" : "ok",
    availableHoursPerWeek,
    requiredHoursPerWeek: workload.totalHoursPerWeek,
    deficitHoursPerWeek: deficit > 0 ? deficit : null,
  };
}
