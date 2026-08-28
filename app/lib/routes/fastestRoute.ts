import type { RoutePolicy } from "./routePolicies";

/** Shortest realistic path: minimum shortlist, minimum lead time on every
 * activity, no optional prep/backup/comparison steps at all -- gets to
 * Application as soon as the minimum real requirements are met, never by
 * hiding a requirement the target university actually publishes (task
 * brief item 5's "Fastest = Eligibility, Documents, Application, Visa,
 * Housing, Travel"). */
export const FASTEST_POLICY: RoutePolicy = {
  type: "fastest",
  shortlistTarget: 3,
  applicationStrategy: "match-heavy",
  riskTolerance: "high",
  budgetSensitivity: "low",
  scholarshipPriority: "low",
  studyIntensity: "low",
  bufferDays: 0,
  portfolioIterations: 1,
  languageMarginBand: 0,
  aggressiveness: 0,
  leadTime: {
    english: { min: 30, max: 45 },
    portfolio: { min: 20, max: 30 },
    entranceExam: { min: 20, max: 30 },
    essay: { min: 10, max: 15 },
    document: { min: 3, max: 7 },
    application: { min: 0, max: 3 },
    scholarship: { min: 0, max: 7 },
    visa: { min: 14, max: 21 },
    housing: { min: 14, max: 21 },
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
    scholarshipStep: false,
  },
};
