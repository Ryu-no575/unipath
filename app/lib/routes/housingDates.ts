import { makeRouteStepDate } from "./backwardPlanner";
import type { RouteContext } from "./context";
import type { RoutePolicy } from "./routePolicies";
import type { RouteStepDate } from "./types";
import { addWeeks, clampToToday, unverifiedDate } from "./dateConfidence";

/** Date Engine v2's Housing domain (task brief PART B item 8). Anchored on
 * the university's own housing_deadline/housing_move_in_date -- never the
 * application deadline. When a real official date exists it's officialDate
 * (exactly like Application's own deadline); the research-start
 * recommendation backward-plans from *that*, using this route's own
 * `housingLeadWeeks`. */
export function buildHousingStepDate(ctx: RouteContext, policy: RoutePolicy): RouteStepDate | null {
  const logistics = ctx.logistics;
  if (!logistics) return null;

  const officialAnchor = logistics.housingDeadline ?? logistics.housingMoveInDate;
  if (!officialAnchor) return unverifiedDate();

  const suggestedStart = clampToToday(addWeeks(officialAnchor, -policy.logistics.housingLeadWeeks), ctx.input.today);
  return makeRouteStepDate({
    officialDate: officialAnchor,
    officialTimezone: logistics.timezone,
    officialSource: logistics.source,
    suggestedDate: suggestedStart,
    suggestedSource: "unipath",
  });
}
