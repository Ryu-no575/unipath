import type { RouteStepParams } from "./steps";

/** Widest shortlist, longest preparation buffer, explicit safety/match/reach
 * classification, and a scholarship step as a preparation cushion. */
export const SAFEST_PARAMS: RouteStepParams = {
  shortlistTarget: 8,
  suggestedLeadDays: 21,
  includeScholarshipStep: true,
  includeShortlistClassification: true,
  includeLanguageImprovement: false,
};
