import type { RouteCapacity, RouteFeasibility, FeasibilityLevel } from "./types";

/** Task brief item 10: refines the existing binary-ish RouteFeasibility
 * (backwardPlanner.ts:assessFeasibility -- feasible/tight/infeasible/
 * unknown_deadline) into the 5-tier label the brief asks for, using only
 * numbers that already exist: how much runway margin exists beyond the bare
 * minimum lead time, and whether a real, user-declared Capacity mismatch
 * makes an otherwise-feasible route harder in practice. Never re-derives
 * "infeasible" into something softer -- a route that structurally can't fit
 * its own required prep stays "not_feasible" regardless of capacity. */
export function computeFeasibilityLevel(feasibility: RouteFeasibility, capacity: RouteCapacity): FeasibilityLevel {
  if (feasibility.status === "unknown_deadline") return "unknown_deadline";
  if (feasibility.status === "infeasible") return "not_feasible";

  const { daysUntilDeadline, minimumLeadDaysNeeded } = feasibility;
  const ratio =
    daysUntilDeadline != null && minimumLeadDaysNeeded != null && minimumLeadDaysNeeded > 0
      ? daysUntilDeadline / minimumLeadDaysNeeded
      : null;

  const capacitySevere = capacity.status === "mismatch" && capacity.deficitHoursPerWeek != null && capacity.requiredHoursPerWeek > 0
    ? capacity.deficitHoursPerWeek / capacity.requiredHoursPerWeek >= 0.5
    : false;

  if (feasibility.status === "tight") {
    return capacitySevere ? "very_tight" : "tight";
  }

  // status === "feasible"
  if (capacitySevere) return "tight";
  if (ratio != null && ratio >= 2) return "comfortable";
  return "feasible";
}
