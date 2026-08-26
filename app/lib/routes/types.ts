import type { ApplicationStatus, Database, DocumentType } from "@/app/lib/supabase/database.types";
import type { ApplicationWithDetails } from "@/app/lib/data/applications";
import type { ApplicationReadinessResult } from "@/app/lib/data/passport";
import type { RealMatchResult } from "@/app/lib/match/real-types";

export type RouteType = "fastest" | "safest" | "budget" | "ambitious" | "balanced";

export const ROUTE_TYPES: RouteType[] = ["fastest", "safest", "budget", "ambitious", "balanced"];

export type RouteStepType =
  | "profile"
  | "language_test"
  | "university_search"
  | "shortlist"
  | "document"
  | "portfolio"
  | "application"
  | "scholarship"
  | "interview"
  | "admission"
  | "payment"
  | "visa"
  | "housing"
  | "travel"
  | "arrival";

export type RouteStepStatus = "done" | "current" | "upcoming";

/** Step types that also appear on /calendar (via tasks or admission cycle
 * deadlines) -- see app/lib/journey.ts:buildCalendarEvents. Used only to
 * decide whether to show a "View in Calendar" link; never changes what the
 * Calendar itself renders. */
export const CALENDAR_LINKED_STEP_TYPES: RouteStepType[] = [
  "language_test",
  "document",
  "portfolio",
  "application",
  "interview",
  "visa",
  "housing",
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
  | "fast_track";

export interface RouteReason {
  kind: RouteReasonKind;
  params?: Record<string, string | number>;
}

export type RouteRiskLevel = "low" | "medium" | "high";
export type RoutePrepLoad = "low" | "medium" | "high";

export interface RouteComparison {
  estimatedDurationMonths: number | null;
  estimatedCost: { amount: number; currency: string } | null;
  risk: RouteRiskLevel;
  preparationLoad: RoutePrepLoad;
}

export interface Route {
  type: RouteType;
  steps: RouteStep[];
  currentStep: RouteStep | null;
  reasons: RouteReason[];
  comparison: RouteComparison;
  scopedUniversityName: string | null;
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
