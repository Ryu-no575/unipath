import type { GapAnalysis } from "./gapAnalysis";
import type { RouteContext } from "./context";
import type { RoutePolicy } from "./routePolicies";
import type { RouteWorkload } from "./types";

/** Base weekly hours per activity by this route's `studyIntensity` policy
 * level -- calibrated so a route with every category active at "high"
 * intensity (Ambitious: English + Portfolio + Entrance Exam + Documents)
 * totals 18h/week, matching task brief item 6's worked example. Only ever
 * applied to a category that is *actually* required by this user's real
 * GapAnalysis -- never charged for prep nobody needs (task brief item 30:
 * no fake workload for a requirement that doesn't exist). */
const HOURS_BY_INTENSITY = {
  low: { english: 2, portfolio: 3, entranceExam: 2, documents: 1 },
  medium: { english: 3, portfolio: 5, entranceExam: 3, documents: 2 },
  high: { english: 5, portfolio: 7, entranceExam: 4, documents: 2 },
} as const;

/** Task brief item 6: "Recommended weekly effort" / "Estimated preparation
 * workload" -- this app has no Schedule/logged-hours data, so every number
 * here is a policy-driven estimate of how much dedicated prep time this
 * route's *actually active* categories call for, never a measured figure.
 * A category is null (not zero) when this route doesn't need it at all, so
 * the UI can omit the row entirely rather than show "0h/week". */
export function computeWorkload(ctx: RouteContext, policy: RoutePolicy, gap: GapAnalysis): RouteWorkload {
  const hours = HOURS_BY_INTENSITY[policy.studyIntensity];

  // gap.english.hasGap already means "current score is below the published
  // target" -- ctx.hasEnglishSignal only means "some test evidence exists"
  // (used for document-readiness tracking, see readiness.ts) and must NOT
  // gate this: a user who already submitted a below-target score still has
  // real work left.
  const needsEnglish = gap.english.hasGap;
  const needsPortfolio = gap.portfolio.required && !gap.portfolio.ready;
  const needsEntranceExam = gap.entranceExam.required && !gap.entranceExam.ready;
  const needsDocuments = ctx.missingDocumentTypes.size > 0;

  const english = needsEnglish ? { hoursPerWeek: hours.english } : null;
  const portfolio = needsPortfolio ? { hoursPerWeek: hours.portfolio } : null;
  const entranceExam = needsEntranceExam ? { hoursPerWeek: hours.entranceExam } : null;
  const documents = needsDocuments ? { hoursPerWeek: hours.documents } : null;

  const totalHoursPerWeek =
    (english?.hoursPerWeek ?? 0) +
    (portfolio?.hoursPerWeek ?? 0) +
    (entranceExam?.hoursPerWeek ?? 0) +
    (documents?.hoursPerWeek ?? 0);

  return { english, portfolio, entranceExam, documents, totalHoursPerWeek };
}
