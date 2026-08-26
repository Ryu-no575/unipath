import type { RouteStepParams } from "./steps";

/** Fewest backup options, shortest preparation buffer -- gets to Application
 * as soon as the minimum real requirements are met, never by hiding a
 * requirement the target university actually publishes. */
export const FASTEST_PARAMS: RouteStepParams = {
  shortlistTarget: 3,
  suggestedLeadDays: 3,
  includeScholarshipStep: false,
  includeShortlistClassification: false,
  includeLanguageImprovement: false,
};
