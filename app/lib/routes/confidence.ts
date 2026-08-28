import type { RouteContext } from "./context";
import type { ConfidenceGapKind, RouteConfidence } from "./types";

/** Task brief item 17: how much of what this route's own numbers rest on is
 * real, Verified official data vs. unknown -- separate from
 * FeasibilityLevel (which is about time, not data completeness). Every gap
 * kind maps to a concrete missing field, never a vague "low confidence". */
export function computeConfidence(ctx: RouteContext): RouteConfidence {
  const gaps: ConfidenceGapKind[] = [];

  const hasScope = ctx.scope.length > 0;
  if (!hasScope || !ctx.earliestDeadline) gaps.push("deadline_missing");
  if (hasScope && ctx.scope.some((s) => s.tuitionAmount == null)) gaps.push("tuition_missing");
  if (ctx.eligibilityCounts.unknown > 0) gaps.push("requirements_unknown");
  if (!ctx.input.profile.onboarding_completed || ctx.englishScore == null) gaps.push("profile_incomplete");

  const level = gaps.length === 0 ? "high" : gaps.length <= 2 ? "medium" : "low";
  return { level, gaps };
}
