import type { RouteType } from "./types";
import { FASTEST_POLICY } from "./fastestRoute";
import { SAFEST_POLICY } from "./safestRoute";
import { BUDGET_POLICY } from "./budgetRoute";
import { AMBITIOUS_POLICY } from "./ambitiousRoute";
import { getBalancedPolicy } from "./balancedRoute";

export type ApplicationStrategy = "reach-heavy" | "match-heavy" | "safety-heavy" | "cost-heavy" | "balanced";
export type PolicyLevel = "low" | "medium" | "high";

export interface LeadTimeRange {
  /** Fewest days before the deadline this activity can realistically start --
   * used for feasibility checks (backwardPlanner.ts:assessFeasibility). */
  min: number;
  /** Most days before the deadline this route wants to start -- how early an
   * aggressive/ambitious policy begins preparing. */
  max: number;
}

/** Task brief item 4: every route defines its own lead-time policy per
 * activity, so backward planning (backwardPlanner.ts) produces genuinely
 * different Suggested Dates from the exact same Official Deadline. */
export interface RouteLeadTimes {
  english: LeadTimeRange;
  portfolio: LeadTimeRange;
  entranceExam: LeadTimeRange;
  essay: LeadTimeRange;
  document: LeadTimeRange;
  application: LeadTimeRange;
  scholarship: LeadTimeRange;
  visa: LeadTimeRange;
  housing: LeadTimeRange;
}

/** Which optional steps this route's policy turns on -- task brief item 5:
 * routes must differ in *which* steps exist, not only in their dates. */
export interface RouteStepSet {
  academicImprovement: boolean;
  /** Full diagnostic -> official-test study plan (task brief item 7),
   * instead of a single plain "reach this score" step. */
  languageImprovementPlan: boolean;
  /** Full study-plan -> mock-exam -> sitting breakdown for a required
   * entrance exam, instead of a single plain step. */
  entranceExamPrepPlan: boolean;
  /** Draft/feedback/revise/final cycles attached to the motivation
   * letter/personal statement document step. */
  essayRefinementCycles: boolean;
  backupUniversities: boolean;
  documentVerification: boolean;
  earlySubmission: boolean;
  backupVisa: boolean;
  multipleHousing: boolean;
  /** Scholarship research / tuition comparison / cost-of-living comparison /
   * affordable housing / flight-price monitoring -- Budget's whole extra
   * step set (task brief item 5). Mutually exclusive with `scholarshipStep`
   * in practice (Budget uses this; Balanced-with-need uses the plain one). */
  budgetSteps: boolean;
  /** The old plain single "Research and apply for scholarships" step. */
  scholarshipStep: boolean;
}

/** Route = Policy (task brief item 1). Every route the engine can generate
 * is one of these -- never a hand-written, one-off step list. */
export interface RoutePolicy {
  type: RouteType;
  shortlistTarget: number;
  applicationStrategy: ApplicationStrategy;
  riskTolerance: PolicyLevel;
  budgetSensitivity: PolicyLevel;
  scholarshipPriority: PolicyLevel;
  studyIntensity: PolicyLevel;
  /** Extra days added on top of a step's interpolated lead time -- Safest's
   * "maximize buffer" policy (task brief item 4). */
  bufferDays: number;
  /** 1 = a single plain portfolio step; >=2 turns on progressive-disclosure
   * iterations (research -> concept -> v1 -> feedback -> ... -> final). */
  portfolioIterations: number;
  /** Added on top of a program's published English minimum when deciding
   * the target score to reach for (Ambitious's "+0.5 band" policy). */
  languageMarginBand: number;
  /** 0..1 -- how early within each lead-time range this route starts an
   * activity. 0 = wait until the min (latest feasible), 1 = start at the
   * max (earliest possible). Interpolated per activity, not a flat offset,
   * so "same deadline, different Route" produces genuinely different
   * per-activity start dates (task brief item 3). */
  aggressiveness: number;
  leadTime: RouteLeadTimes;
  includeShortlistClassification: boolean;
  steps: RouteStepSet;
}

/** The single place that resolves "which policy does this route type use" --
 * generateRoute.ts (and nothing else) calls this. */
export function policyFor(type: RouteType, scholarshipNeed: boolean): RoutePolicy {
  switch (type) {
    case "fastest":
      return FASTEST_POLICY;
    case "safest":
      return SAFEST_POLICY;
    case "budget":
      return BUDGET_POLICY;
    case "ambitious":
      return AMBITIOUS_POLICY;
    case "balanced":
      return getBalancedPolicy(scholarshipNeed);
  }
}
