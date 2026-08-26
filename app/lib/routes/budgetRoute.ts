import type { RouteStepParams } from "./steps";

/** Prioritizes tuition/scholarship/housing cost over speed -- a wider net
 * for affordable options plus a mandatory scholarship step. */
export const BUDGET_PARAMS: RouteStepParams = {
  shortlistTarget: 6,
  suggestedLeadDays: 14,
  includeScholarshipStep: true,
  includeShortlistClassification: false,
  includeLanguageImprovement: false,
};
