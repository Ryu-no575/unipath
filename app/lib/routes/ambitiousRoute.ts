import type { RouteStepParams } from "./steps";

/** A tighter, more selective shortlist deliberately including reach-tier
 * options, plus an explicit score-improvement step whenever a real gap
 * exists against a target program's own published minimum. */
export const AMBITIOUS_PARAMS: RouteStepParams = {
  shortlistTarget: 4,
  suggestedLeadDays: 14,
  includeScholarshipStep: false,
  includeShortlistClassification: true,
  includeLanguageImprovement: true,
};
