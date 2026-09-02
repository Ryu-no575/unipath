import type { RoutePolicy } from "./routePolicies";

/** Middle-of-the-road on every lead time, shortlist size, and buffer.
 * Whether a scholarship step appears is the one real, user-specific signal
 * this route uses: match_preferences.scholarship_need (set in the Match
 * Quiz), not a fixed policy choice like Budget/Safest always including it
 * (task brief item 5's "Balanced uses the above only within a moderate
 * range"). */
export function getBalancedPolicy(scholarshipNeed: boolean): RoutePolicy {
  return {
    type: "balanced",
    shortlistTarget: 5,
    applicationStrategy: "balanced",
    riskTolerance: "medium",
    budgetSensitivity: "medium",
    scholarshipPriority: scholarshipNeed ? "medium" : "low",
    studyIntensity: "medium",
    bufferDays: 10,
    portfolioIterations: 2,
    languageMarginBand: 0.25,
    aggressiveness: 0.5,
    leadTime: {
      english: { min: 60, max: 120 },
      portfolio: { min: 60, max: 120 },
      entranceExam: { min: 60, max: 120 },
      essay: { min: 30, max: 60 },
      document: { min: 14, max: 21 },
      application: { min: 7, max: 14 },
      scholarship: { min: 30, max: 45 },
    },
    logistics: {
      visaWindowPosition: 0.5,
      visaBufferDays: 0,
      housingLeadWeeks: 4,
      travelBufferDays: 2,
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
      budgetSteps: false,
      scholarshipStep: scholarshipNeed,
    },
  };
}
