import type { RoutePolicy } from "./routePolicies";

/** Widest shortlist, largest buffer, and a full set of backup/verification
 * steps -- lowers preparation risk rather than chasing higher-selectivity
 * targets (task brief item 5's "Safest = + Backup universities, Document
 * verification, Early submission, Backup visa preparation, Multiple housing
 * options"). */
export const SAFEST_POLICY: RoutePolicy = {
  type: "safest",
  shortlistTarget: 8,
  applicationStrategy: "safety-heavy",
  riskTolerance: "low",
  budgetSensitivity: "medium",
  scholarshipPriority: "medium",
  studyIntensity: "medium",
  bufferDays: 30,
  portfolioIterations: 2,
  languageMarginBand: 0.25,
  aggressiveness: 0.6,
  leadTime: {
    english: { min: 90, max: 150 },
    portfolio: { min: 90, max: 150 },
    entranceExam: { min: 90, max: 150 },
    essay: { min: 45, max: 75 },
    document: { min: 21, max: 35 },
    application: { min: 14, max: 25 },
    scholarship: { min: 30, max: 45 },
  },
  logistics: {
    visaWindowPosition: 0.8,
    visaBufferDays: 14,
    housingLeadWeeks: 10,
    travelBufferDays: 5,
  },
  includeShortlistClassification: true,
  steps: {
    academicImprovement: false,
    languageImprovementPlan: false,
    entranceExamPrepPlan: false,
    essayRefinementCycles: false,
    backupUniversities: true,
    documentVerification: true,
    earlySubmission: true,
    backupVisa: true,
    multipleHousing: true,
    budgetSteps: false,
    scholarshipStep: true,
  },
};
