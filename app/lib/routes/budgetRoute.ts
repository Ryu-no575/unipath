import type { RoutePolicy } from "./routePolicies";

/** Prioritizes tuition/scholarship/cost-of-living/housing affordability over
 * speed or selectivity -- starts scholarship and cost-comparison steps
 * earlier than any other route (task brief item 4's Budget lead times) and
 * replaces the plain "scholarship" step with the full cost-planning step
 * set (task brief item 5). */
export const BUDGET_POLICY: RoutePolicy = {
  type: "budget",
  shortlistTarget: 6,
  applicationStrategy: "cost-heavy",
  riskTolerance: "medium",
  budgetSensitivity: "high",
  scholarshipPriority: "high",
  studyIntensity: "low",
  bufferDays: 7,
  portfolioIterations: 1,
  languageMarginBand: 0,
  aggressiveness: 0.3,
  leadTime: {
    english: { min: 45, max: 75 },
    portfolio: { min: 30, max: 60 },
    entranceExam: { min: 30, max: 60 },
    essay: { min: 20, max: 30 },
    document: { min: 14, max: 21 },
    application: { min: 7, max: 14 },
    scholarship: { min: 60, max: 90 },
  },
  logistics: {
    visaWindowPosition: 0.5,
    visaBufferDays: 0,
    housingLeadWeeks: 8,
    travelBufferDays: 3,
  },
  includeShortlistClassification: false,
  steps: {
    academicImprovement: false,
    languageImprovementPlan: false,
    entranceExamPrepPlan: false,
    essayRefinementCycles: false,
    backupUniversities: false,
    documentVerification: false,
    earlySubmission: false,
    backupVisa: false,
    multipleHousing: false,
    budgetSteps: true,
    scholarshipStep: false,
  },
};
