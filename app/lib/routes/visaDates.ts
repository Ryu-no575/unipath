import type { RouteContext } from "./context";
import type { RoutePolicy } from "./routePolicies";
import type { RouteStepDate } from "./types";
import { addDays, addMonths, addWeeks, clampToToday, estimatedWindowDate, interpolateBetween, unverifiedDate } from "./dateConfidence";

const RECOMMENDED_WINDOW_HALF_WIDTH_DAYS = 15;

/** Date Engine v2's Visa domain (task brief PART B items 6/7/13). Anchored on
 * the user's real program start date and a real, admin-verified
 * visa_requirement_profiles timing row -- never on the application deadline
 * (that reuse was the bug in the old buildTaskDrivenStep). Returns:
 *  - null when Visa isn't relevant yet (no accepted/previewed destination at all)
 *  - unverifiedDate() when a destination exists but no matching official
 *    timing data has been verified yet ("Being verified" -- task item 4/6,
 *    never a fabricated day count)
 *  - a real estimated_window RouteStepDate once program start date + every
 *    official timing field is known.
 */
export function buildVisaStepDate(ctx: RouteContext, policy: RoutePolicy): RouteStepDate | null {
  const logistics = ctx.logistics;
  if (!logistics) return null;

  const timing = ctx.input.visaTiming;
  if (!timing) return unverifiedDate();

  const { profile } = timing;
  const programStartDate = logistics.programStartDate;
  if (
    !programStartDate ||
    profile.earliest_application_months_before_start == null ||
    profile.processing_weeks_min == null ||
    profile.processing_weeks_max == null ||
    profile.latest_safe_submission_weeks_before_start == null
  ) {
    return unverifiedDate();
  }

  const earliestApplicationDate = addMonths(programStartDate, -profile.earliest_application_months_before_start);
  const latestSafeSubmissionDate = addWeeks(programStartDate, -profile.latest_safe_submission_weeks_before_start);

  // windowPosition: 0 = latest safe date, 1 = earliest allowed date -- same
  // interpolation shape as backwardPlanner.interpolateLeadDays, applied to a
  // real official window instead of a hand-picked day range.
  const recommendedPoint = interpolateBetween(
    latestSafeSubmissionDate,
    earliestApplicationDate,
    policy.logistics.visaWindowPosition,
  );
  const bufferedPoint = addDays(recommendedPoint, -policy.logistics.visaBufferDays);

  const clampWithinOfficialWindow = (iso: string): string => {
    const earliest = new Date(earliestApplicationDate).getTime();
    const latest = new Date(latestSafeSubmissionDate).getTime();
    const t = new Date(iso).getTime();
    if (t < earliest) return earliestApplicationDate;
    if (t > latest) return latestSafeSubmissionDate;
    return iso;
  };

  const centerPoint = clampWithinOfficialWindow(bufferedPoint);
  const windowStart = clampToToday(
    clampWithinOfficialWindow(addDays(centerPoint, -RECOMMENDED_WINDOW_HALF_WIDTH_DAYS)),
    ctx.input.today,
  );
  const windowEnd = clampToToday(
    clampWithinOfficialWindow(addDays(centerPoint, RECOMMENDED_WINDOW_HALF_WIDTH_DAYS)),
    ctx.input.today,
  );

  return estimatedWindowDate({
    startISO: windowStart,
    endISO: windowEnd,
    officialSource: timing.source,
  });
}
