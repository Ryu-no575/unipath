import type { RouteContext } from "./context";
import type { RoutePolicy } from "./routePolicies";
import type { RouteStepDate } from "./types";
import { addDays, clampToToday, estimatedWindowDate, unverifiedDate } from "./dateConfidence";

const WINDOW_WIDTH_DAYS = 5;

/** Date Engine v2's Travel domain (task brief PART B item 9). Anchored on
 * orientation/program-start/housing-move-in dates -- never the application
 * deadline, and never a single fabricated exact day (only a recommended
 * arrival *window*, per task item 17). The window always ends *before* the
 * earliest real logistics anchor, so a route never recommends arriving after
 * orientation has already started. This is always confidence
 * "estimated_window" (a window, never an "official" instant) precisely so it
 * can never read as a confirmed booking -- a visa-needing user is never
 * pushed toward a "confirmed" date before their visa is approved. */
export function buildTravelStepDate(ctx: RouteContext, policy: RoutePolicy): RouteStepDate | null {
  const logistics = ctx.logistics;
  if (!logistics) return null;

  const anchors = [logistics.orientationDate, logistics.programStartDate, logistics.housingMoveInDate].filter(
    (d): d is string => Boolean(d),
  );
  if (anchors.length === 0) return unverifiedDate();

  const earliestAnchor = anchors.reduce((a, b) => (new Date(a).getTime() < new Date(b).getTime() ? a : b));
  const windowEnd = clampToToday(addDays(earliestAnchor, -policy.logistics.travelBufferDays), ctx.input.today);
  const windowStart = clampToToday(addDays(windowEnd, -WINDOW_WIDTH_DAYS), ctx.input.today);

  return estimatedWindowDate({ startISO: windowStart, endISO: windowEnd });
}
