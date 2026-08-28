import type { RoutePolicy } from "./routePolicies";

/** A tighter, more selective shortlist deliberately including reach-tier
 * options, plus the full set of "close the gap" steps: academic
 * improvement, a full English study plan, multiple portfolio iterations,
 * entrance-exam prep, and essay refinement cycles -- all started earlier
 * than any other route (aggressiveness 1 = start at each activity's longest
 * lead time), per task brief items 2 and 4. */
export const AMBITIOUS_POLICY: RoutePolicy = {
  type: "ambitious",
  shortlistTarget: 5,
  applicationStrategy: "reach-heavy",
  riskTolerance: "high",
  budgetSensitivity: "low",
  scholarshipPriority: "low",
  studyIntensity: "high",
  bufferDays: 20,
  portfolioIterations: 3,
  languageMarginBand: 0.5,
  aggressiveness: 1,
  leadTime: {
    english: { min: 120, max: 240 },
    portfolio: { min: 150, max: 240 },
    entranceExam: { min: 120, max: 200 },
    essay: { min: 90, max: 150 },
    document: { min: 30, max: 45 },
    application: { min: 21, max: 30 },
    scholarship: { min: 30, max: 45 },
    visa: { min: 30, max: 45 },
    housing: { min: 30, max: 45 },
  },
  includeShortlistClassification: true,
  steps: {
    academicImprovement: true,
    languageImprovementPlan: true,
    entranceExamPrepPlan: true,
    essayRefinementCycles: true,
    backupUniversities: false,
    documentVerification: false,
    earlySubmission: false,
    backupVisa: false,
    multipleHousing: false,
    budgetSteps: false,
    scholarshipStep: false,
  },
};
