import type { ApplicationStatus, Database, DocumentType } from "@/app/lib/supabase/database.types";
import type { ApplicationWithDetails } from "@/app/lib/data/applications";
import type { ApplicationReadinessResult } from "@/app/lib/data/passport";
import type { RealMatchResult } from "@/app/lib/match/real-types";

export type RouteType = "fastest" | "safest" | "budget" | "ambitious" | "balanced";

export const ROUTE_TYPES: RouteType[] = ["fastest", "safest", "budget", "ambitious", "balanced"];

/** Every Route-only step type -- see routePolicies.ts for which of these
 * each route's policy actually turns on. Task brief item 5: routes must
 * differ in *which* steps appear, never just in labels on a fixed list. */
export type RouteStepType =
  | "profile"
  | "academic_improvement"
  | "language_test"
  | "university_search"
  | "shortlist"
  | "backup_universities"
  | "document"
  | "document_verification"
  | "portfolio"
  | "entrance_exam"
  | "scholarship"
  | "scholarship_research"
  | "tuition_comparison"
  | "cost_of_living"
  | "affordable_housing"
  | "flight_monitoring"
  | "application"
  | "early_submission"
  | "interview"
  | "admission"
  | "payment"
  | "visa"
  | "backup_visa"
  | "housing"
  | "multiple_housing"
  | "travel"
  | "arrival";

export type RouteStepStatus = "done" | "current" | "upcoming";

/** Step types that also appear on /calendar (via tasks, admission cycle
 * deadlines, or a route's own backward-planned suggested dates -- see
 * routeCalendarSync.ts). Used only to decide whether to show a "View in
 * Calendar" link; never changes what the Calendar itself renders. */
export const CALENDAR_LINKED_STEP_TYPES: RouteStepType[] = [
  "academic_improvement",
  "language_test",
  "backup_universities",
  "document",
  "document_verification",
  "portfolio",
  "entrance_exam",
  "scholarship",
  "scholarship_research",
  "tuition_comparison",
  "cost_of_living",
  "affordable_housing",
  "flight_monitoring",
  "application",
  "early_submission",
  "interview",
  "visa",
  "backup_visa",
  "housing",
  "multiple_housing",
  "travel",
];

/** Where a step's suggestedDate came from -- must stay visibly distinct from
 * an official date everywhere it's rendered (task brief item 10/13). */
export type SuggestedDateSource = "unipath" | "task";

export interface RouteStepDate {
  /** From admission_cycles.application_deadline (or the equivalent custom_*
   * field) -- a verified official fact, never computed. Null when unknown. */
  officialDate: string | null;
  officialTimezone: string | null;
  /** Either a UniPath-computed preparation buffer before officialDate, or an
   * existing task's own due_at the user set -- see `suggestedSource`. */
  suggestedDate: string | null;
  suggestedSource: SuggestedDateSource | null;
}

export interface RouteStepLabelParams {
  documentType?: DocumentType;
  currentScore?: string | null;
  targetScore?: string | null;
  count?: number;
  targetCount?: number;
  safetyCount?: number;
  matchCount?: number;
  reachCount?: number;
  unclassifiedCount?: number;
  universityName?: string | null;
  submittedCount?: number;
  totalCount?: number;
  /** Which iteration of a repeating sub-step this is (portfolio v{n}, etc). */
  iteration?: number;
}

/** One entry in a closed vocabulary of sub-tasks a step can expand into --
 * Progressive Disclosure (task brief item 7): the Route Map shows only the
 * parent step ("English preparation"); expanding it reveals these. Every key
 * must have a matching "RouteSubStepOptions" message (see labels.ts). */
export type RouteSubStepKey =
  | "diagnostic_test"
  | "vocab_grammar"
  | "reading_practice"
  | "listening_practice"
  | "writing_practice"
  | "speaking_practice"
  | "mock_test"
  | "weakness_review"
  | "official_test"
  | "exam_study_plan"
  | "exam_topic_preparation"
  | "exam_practice_questions"
  | "exam_mock_exam"
  | "exam_final_review"
  | "exam_sitting"
  | "portfolio_research"
  | "portfolio_concept"
  | "portfolio_draft"
  | "portfolio_feedback"
  | "portfolio_final"
  | "essay_draft"
  | "essay_feedback"
  | "essay_revise"
  | "essay_final";

export interface RouteSubStep {
  key: RouteSubStepKey;
  done: boolean;
  date: RouteStepDate | null;
  labelParams: RouteStepLabelParams;
}

export interface RouteStep {
  id: string;
  type: RouteStepType;
  status: RouteStepStatus;
  labelParams: RouteStepLabelParams;
  date: RouteStepDate | null;
  applicationId: string | null;
  taskId: string | null;
  calendarLinked: boolean;
  /** Empty when this step has no useful breakdown -- the UI only renders an
   * expand affordance when this is non-empty (task brief item 7). */
  subSteps: RouteSubStep[];
}

export type RouteReasonKind =
  | "profile_ready"
  | "profile_incomplete"
  | "english_met"
  | "english_gap"
  | "deadline_in_months"
  | "no_known_deadline"
  | "documents_ready_percent"
  | "shortlist_target"
  | "scholarship_prioritized"
  | "scholarship_signal"
  | "budget_focus"
  | "safety_focus"
  | "reach_included"
  | "fast_track"
  | "large_buffer"
  | "portfolio_iterations"
  | "entrance_exam_prep"
  | "academic_improvement_reach"
  | "feasibility_tight"
  | "feasibility_infeasible"
  // Route Decision Engine v2 -- "Why recommended?" reasons (routeRecommendation.ts).
  // Reuses this same kind + params + translation pattern (task brief item 15).
  | "capacity_fits"
  | "capacity_exceeded"
  | "already_close_to_requirement"
  | "budget_compatible_count"
  | "time_sufficient_iterations"
  | "lower_prep_than_alternative"
  | "best_feasibility";

export interface RouteReason {
  kind: RouteReasonKind;
  params?: Record<string, string | number>;
}

export type RouteRiskLevel = "low" | "medium" | "high";
export type RoutePrepLoad = "low" | "medium" | "high";
export type StudyIntensity = "low" | "medium" | "high";

/** Whether a route's own preparation chain can realistically fit before the
 * verified deadline -- task brief item 15/16. Never invents a deadline: when
 * none is known/verified, status is "unknown_deadline" and every date on the
 * route is a bare sequence (see backwardPlanner.ts). */
export type RouteFeasibilityStatus = "feasible" | "tight" | "infeasible" | "unknown_deadline";

export interface RouteFeasibility {
  status: RouteFeasibilityStatus;
  daysUntilDeadline: number | null;
  minimumLeadDaysNeeded: number | null;
}

export interface RouteComparison {
  estimatedDurationMonths: number | null;
  estimatedCost: { amount: number; currency: string } | null;
  risk: RouteRiskLevel;
  preparationLoad: RoutePrepLoad;
  /** How much dedicated study/prep work (English, portfolio, entrance exam)
   * this route's policy asks for -- task brief item 19's "Extra study". */
  extraStudy: StudyIntensity;
  /** ISO date of the earliest not-yet-done, dated step -- task brief item
   * 19's "Starts". Null means nothing is dated yet (equivalent to "Now"). */
  startsDate: string | null;
  feasibility: RouteFeasibility;
}

export interface Route {
  type: RouteType;
  steps: RouteStep[];
  currentStep: RouteStep | null;
  reasons: RouteReason[];
  comparison: RouteComparison;
  scopedUniversityName: string | null;
  // Route Decision Engine v2 additions -- see generateRoute.ts for how each
  // is computed from the same ctx/policy/gap/steps every other field uses.
  scorecard: RouteScorecard;
  workload: RouteWorkload;
  capacity: RouteCapacity;
  feasibilityLevel: FeasibilityLevel;
  bottlenecks: Bottleneck[];
  confidence: RouteConfidence;
  scenarios: RouteScenario[];
  portfolio: PortfolioStrategy;
  recommendedCandidates: RouteUniversityCandidate[];
}

// ---------------------------------------------------------------------------
// Route comparison diff -- "Switching to X route will: ..." (task brief item
// 9/19). Always computed from two already-generated Routes, never a separate
// hand-written explanation.
// ---------------------------------------------------------------------------

export type RouteDiffKind =
  | "starts_earlier"
  | "starts_later"
  | "adds_step"
  | "removes_step"
  | "step_moves_earlier"
  | "step_moves_later"
  | "adds_portfolio_iterations"
  | "removes_portfolio_iterations"
  | "shortlist_target_change";

export interface RouteDiffEntry {
  kind: RouteDiffKind;
  stepType?: RouteStepType;
  params?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Engine input -- assembled once per request by app/lib/data/routes.ts from
// real Supabase rows. The engine itself never queries Supabase directly.
// ---------------------------------------------------------------------------

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TestScoreRow = Database["public"]["Tables"]["test_scores"]["Row"];
type ApplicationDocumentRow = Database["public"]["Tables"]["application_documents"]["Row"];
type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];

export interface RouteApplication {
  application: ApplicationWithDetails;
  requirements: AdmissionRequirementRow[];
  readiness: ApplicationReadinessResult;
  /** From admission_cycles.tuition/tuition_currency -- ApplicationWithDetails'
   * own admissionCycle summary doesn't carry these (see
   * app/lib/data/applications.ts), so app/lib/data/routes.ts fetches them
   * separately. Null for custom-university applications or an unpublished
   * tuition figure -- never estimated. */
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
}

export interface RouteTarget {
  universityId: string;
  universityName: string;
  programId: string | null;
  admissionCycle: ApplicationWithDetails["admissionCycle"];
  requirements: AdmissionRequirementRow[];
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  /** From the real Match engine, when the target also appears in the user's
   * match candidates -- display-only, never used as an admission-probability
   * signal (task brief item 13). */
  matchScorePercent: number | null;
}

export interface RouteEngineInput {
  /** ISO date (yyyy-mm-dd), injected so the engine is deterministic/testable. */
  today: string;
  profile: ProfileRow;
  scholarshipNeed: boolean;
  applications: RouteApplication[];
  tasks: TaskRow[];
  testScores: TestScoreRow[];
  documents: ApplicationDocumentRow[];
  linkedDocumentIds: Set<string>;
  matchResults: RealMatchResult[];
  target: RouteTarget | null;
}

export const APPLICATION_ACTIVE_STATUSES: ApplicationStatus[] = [
  "preparing",
  "applied",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
];

// ---------------------------------------------------------------------------
// Route Decision Engine v2 -- comparison dimensions, workload, capacity,
// feasibility level, bottlenecks, confidence, scenarios, portfolio strategy,
// and a route-specific recommended candidate slate. Every value here is
// computed from RouteContext/GapAnalysis/RoutePolicy/RouteStep -- see each
// module under app/lib/routes/ named after the concept -- never a separate
// hand-authored number (task brief item 39: "計算構造", never a decoration).
// ---------------------------------------------------------------------------

/** The 14 comparison dimensions task brief item 1 requires. Deliberately
 * excludes admission probability -- "backupStrength"/"feasibility" are
 * derived from buffer/backups/eligibility gaps, never a chance-of-admission
 * estimate. */
export type ScorecardDimension =
  | "time"
  | "cost"
  | "preparationLoad"
  | "academicImprovement"
  | "deadlineBuffer"
  | "applicationCoverage"
  | "scholarshipEffort"
  | "documentWorkload"
  | "portfolioWorkload"
  | "examWorkload"
  | "backupStrength"
  | "flexibility"
  | "dataConfidence"
  | "feasibility";

/** 0-10; null only when the underlying real data needed to score this
 * dimension doesn't exist yet (e.g. feasibility with no verified deadline at
 * all) -- the UI must render "Unknown", never a fabricated bar. */
export type RouteScorecard = Record<ScorecardDimension, number | null>;

export interface WorkloadCategory {
  hoursPerWeek: number;
}

/** Task brief item 6: "Recommended weekly effort" when the user has no
 * logged Schedule data (which this app doesn't track) -- always presented as
 * an *estimate* of preparation load, never as a measured, actual figure. */
export interface RouteWorkload {
  english: WorkloadCategory | null;
  portfolio: WorkloadCategory | null;
  entranceExam: WorkloadCategory | null;
  documents: WorkloadCategory | null;
  totalHoursPerWeek: number;
}

export type CapacityStatus = "unknown" | "ok" | "mismatch";

/** Task brief item 7: compares a route's own RouteWorkload against the
 * user's optionally-declared `profiles.weekly_study_hours_available`.
 * "unknown" (not "ok") is the default when the user has never set that
 * field -- never assume capacity is sufficient just because it's unstated. */
export interface RouteCapacity {
  status: CapacityStatus;
  availableHoursPerWeek: number | null;
  requiredHoursPerWeek: number;
  deficitHoursPerWeek: number | null;
}

/** Task brief item 10's 5-tier feasibility label, refined from
 * RouteFeasibility (backwardPlanner.ts) by how much runway margin exists
 * beyond the bare minimum, and downgraded further on a real Capacity
 * mismatch. "unknown_deadline" mirrors RouteFeasibilityStatus verbatim --
 * never invented when no deadline is verified yet. */
export type FeasibilityLevel = "comfortable" | "feasible" | "tight" | "very_tight" | "not_feasible" | "unknown_deadline";

export type BottleneckKind =
  | "english_gap"
  | "portfolio"
  | "entrance_exam"
  | "document_readiness"
  | "short_lead_time"
  | "capacity_mismatch";

export type BottleneckSeverity = "critical" | "high" | "medium";

/** Task brief item 9: ranked, real reasons this specific route is hard --
 * never a generic list, always tied to a real gap/lead-time/capacity number
 * also visible elsewhere on the page. */
export interface Bottleneck {
  kind: BottleneckKind;
  severity: BottleneckSeverity;
  params?: Record<string, string | number>;
}

export type RouteConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceGapKind = "deadline_missing" | "tuition_missing" | "requirements_unknown" | "profile_incomplete";

/** Task brief item 17: how much of what this route's numbers rest on is
 * actually Verified official data vs. unknown -- separate from
 * FeasibilityLevel (which is about time, not data completeness). */
export interface RouteConfidence {
  level: RouteConfidenceLevel;
  gaps: ConfidenceGapKind[];
}

export type ScenarioKind = "start_earlier" | "english_gap_closed" | "portfolio_ready" | "entrance_exam_ready";

/** Task brief item 11: a What-if computed by re-running the exact same
 * feasibility calculation under one changed, realistic assumption -- never a
 * freeform prediction. Only ever constructed when the underlying real gap
 * exists (e.g. english_gap_closed only when GapAnalysis.english.hasGap). */
export interface RouteScenario {
  kind: ScenarioKind;
  beforeLevel: FeasibilityLevel;
  afterLevel: FeasibilityLevel;
  params?: Record<string, string | number>;
}

/** Task brief item 13: Reach/Core/Backup counts among the user's *actual*
 * shortlisted applications (real admission_requirements -> real
 * EligibilityTier via eligibility.ts), plus each route's own target
 * distribution -- never redefined as an admission-probability bucket. */
export interface PortfolioStrategy {
  reach: { count: number; target: number | null };
  core: { count: number; target: number | null };
  backup: { count: number; target: number | null };
  unclassified: number;
}

/** Task brief item 12: one real, verified-catalog program (from
 * RealMatchResult -- see app/lib/match/real-types.ts) recommended for this
 * specific route, distinct from the user's own applications. `reasonKind`
 * names the real field this route's own selection criteria sorted on --
 * never an admission-probability label. */
export type RouteUniversityCandidateReason = "top_match" | "low_prep_gap" | "low_tuition" | "long_buffer" | "reach_option";

export interface RouteUniversityCandidate {
  programId: string;
  universityId: string;
  universityName: string;
  programName: string;
  matchScorePercent: number;
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  applicationDeadline: string | null;
  reasonKind: RouteUniversityCandidateReason;
}

export interface RouteRecommendation {
  recommendedType: RouteType;
  reasons: RouteReason[];
}
