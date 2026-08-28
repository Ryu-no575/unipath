import type { RouteContext } from "./context";
import type { RoutePolicy } from "./routePolicies";
import type { PortfolioStrategy } from "./types";

/** Task brief item 13: classifies the user's *actual* shortlisted
 * applications into Reach/Core/Backup using the same real EligibilityTier
 * (eligibility.ts -- published requirement vs. actual score) every other
 * part of the engine already uses, renamed to the brief's vocabulary:
 * reach = "reach" tier, core = "match" tier, backup = "safety" tier.
 * Deliberately never redefined as admission probability. `target` per
 * bucket is this route's own policy target -- backup's target mirrors
 * buildBackupUniversitiesStep's own formula (steps.ts) so the two numbers
 * shown to the user can never drift apart; reach/core targets are only set
 * for routes whose policy actually shapes them (Ambitious's reach floor). */
export function computePortfolioStrategy(ctx: RouteContext, policy: RoutePolicy): PortfolioStrategy {
  const backupTarget = policy.steps.backupUniversities ? Math.max(2, Math.round(policy.shortlistTarget * 0.3)) : null;
  const reachTarget = policy.steps.academicImprovement ? Math.max(1, Math.round(policy.shortlistTarget * 0.25)) : null;

  return {
    reach: { count: ctx.eligibilityCounts.reach, target: reachTarget },
    core: { count: ctx.eligibilityCounts.match, target: null },
    backup: { count: ctx.eligibilityCounts.safety, target: backupTarget },
    unclassified: ctx.eligibilityCounts.unknown,
  };
}
