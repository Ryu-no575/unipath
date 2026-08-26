import type { RouteStepParams } from "./steps";

/** Middle-of-the-road on shortlist size and preparation buffer. Whether a
 * scholarship step appears is the one real, user-specific signal this route
 * uses: match_preferences.scholarship_need (set in the Match Quiz), not a
 * fixed policy choice like Budget/Safest always including it. */
export function getBalancedParams(scholarshipNeed: boolean): RouteStepParams {
  return {
    shortlistTarget: 5,
    suggestedLeadDays: 14,
    includeScholarshipStep: scholarshipNeed,
    includeShortlistClassification: false,
    includeLanguageImprovement: false,
  };
}
