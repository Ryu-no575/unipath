import type { RouteContext } from "./context";
import type { RouteSubStep, RouteSubStepKey } from "./types";
import { unverifiedDate } from "./dateConfidence";

const ARRIVAL_ITEM_KEY_TO_SUBSTEP: Partial<Record<string, RouteSubStepKey>> = {
  residence_permit_registration: "residence_permit_registration",
  local_registration: "local_registration",
  student_card_registration: "student_card_registration",
  health_registration: "health_registration",
};

/** Date Engine v2's Arrival domain (task brief PART B item 10). Post-arrival
 * legal deadlines ("register your residence permit within N days") are
 * genuinely only knowable relative to the day the user actually arrives --
 * this app has no "confirmed arrival" event to count from, so every item
 * here is undated ("Check after arrival" / "Being verified" -- item 10's
 * explicit fallback), never a guessed absolute date. Only surfaced when a
 * real, admin-verified visa_requirement_items row exists for this item key;
 * `deadline_days_after_arrival` itself is intentionally unused for date math
 * here for that reason, but is what a future "I've arrived" event would
 * finally resolve against. */
export function buildArrivalSubSteps(ctx: RouteContext): RouteSubStep[] {
  const items = ctx.input.visaTiming?.postArrivalItems ?? [];
  return items.flatMap((item): RouteSubStep[] => {
    const key = ARRIVAL_ITEM_KEY_TO_SUBSTEP[item.item_key];
    if (!key) return [];
    return [{ key, done: false, date: unverifiedDate(), labelParams: {} }];
  });
}
