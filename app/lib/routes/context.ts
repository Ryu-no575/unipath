import type {
  ApplicationStatus,
  DocumentType,
  TaskType,
  TestType,
  Database,
} from "@/app/lib/supabase/database.types";
import {
  computeApplicationReadiness,
  hasEnglishSignal as computeHasEnglishSignal,
  type ApplicationReadiness,
} from "@/app/lib/passport/readiness";
import { assessEligibility, type EligibilityTier } from "./eligibility";
import { APPLICATION_ACTIVE_STATUSES, type DateSourceInfo, type RouteEngineInput } from "./types";

type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export interface ScopeItem {
  /** Null in target-preview mode (a prospective university with no
   * applications row yet -- see app/lib/data/routes.ts). */
  applicationId: string | null;
  universityName: string | null;
  status: ApplicationStatus | null;
  applicationDeadline: string | null;
  deadlineTimezone: string | null;
  /** Task brief item 6/16: the real `sources` row backing applicationDeadline,
   * when one is linked -- null for a custom university or an unlinked cycle,
   * never fabricated. */
  applicationDeadlineSource: DateSourceInfo | null;
  requirements: AdmissionRequirementRow[];
  readiness: ApplicationReadiness;
  eligibilityTier: EligibilityTier;
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  // Date Engine v2 anchors -- real program logistics, never the application
  // deadline above (see visaDates.ts/housingDates.ts/travelDates.ts).
  destinationCountryCode: string | null;
  programStartDate: string | null;
  orientationDate: string | null;
  housingDeadline: string | null;
  housingMoveInDate: string | null;
}

/** The single ScopeItem Visa/Housing/Travel/Arrival anchor off of -- the
 * user's accepted offer once one exists (a real destination is fixed), else
 * whichever item is driving `earliestDeadline` (a reasonable preview target),
 * else null when there's nothing to anchor to yet (task brief item 3: never
 * borrow the Application deadline for these domains). */
export interface LogisticsAnchor {
  destinationCountryCode: string | null;
  programStartDate: string | null;
  orientationDate: string | null;
  housingDeadline: string | null;
  housingMoveInDate: string | null;
  /** Task brief item 6/16: same `sources` row backing this item's
   * applicationDeadline -- the university's own admission-cycle page
   * typically lists housing/logistics info alongside the deadline, so
   * housingDates.ts's own officialDate reuses it rather than going
   * unsourced. Null when nothing is linked yet. */
  source: DateSourceInfo | null;
  timezone: string | null;
  /** True once the user has a real accepted offer -- travelDates.ts uses this
   * to decide whether "confirmed" travel language is even appropriate yet. */
  isAccepted: boolean;
}

export interface RouteContext {
  input: RouteEngineInput;
  isTargetMode: boolean;
  scopedUniversityName: string | null;
  scope: ScopeItem[];
  englishScore: number | null;
  hasEnglishSignal: boolean;
  shortlistCount: number;
  activeCount: number;
  submittedCount: number;
  acceptedCount: number;
  earliestDeadline: { date: string; timezone: string; source: DateSourceInfo | null } | null;
  logistics: LogisticsAnchor | null;
  missingDocumentTypes: Map<DocumentType, string[]>;
  portfolioRequired: boolean;
  portfolioReady: boolean;
  readinessAvgPercent: number | null;
  eligibilityCounts: { safety: number; match: number; reach: number; unknown: number };
  reachEnglishTarget: number | null;
  /** The single toughest published English minimum across the whole scope
   * (not just reach-tier items) -- what "improve your English" actually
   * targets, regardless of route. */
  toughestEnglishTarget: number | null;
  /** A real, classified (never guessed) non-English standardized-test
   * requirement -- e.g. SAT/ACT/GRE/GMAT -- surfaced by at least one
   * in-scope program's admission_requirements. */
  entranceExamRequired: boolean;
  entranceExamReady: boolean;
  entranceExamTestHint: TestType | null;
  hasInterviewSignal: boolean;
  completedTaskTypes: Set<TaskType>;
  anyTaskByType: Map<TaskType, TaskRow[]>;
}

const SUBMITTED_STATUSES: ApplicationStatus[] = ["applied", "interview", "accepted", "rejected", "withdrawn"];

/** Standardized tests that are never the English requirement -- when one of
 * these is a real, classified requirement (see classifyRequirement), the
 * program has an entrance exam. Never inferred from anything else. */
const ENTRANCE_EXAM_TEST_TYPES: TestType[] = ["sat", "act", "gre", "gmat"];

/** Shared with app/lib/eligibility/programEligibility.ts -- keeps "what
 * counts as the user's current English score" identical between the Route
 * engine's gap analysis and the Eligibility Engine. */
export function parseEnglishScore(scoreText: string | null): number | null {
  if (!scoreText) return null;
  const match = scoreText.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function buildRouteContext(input: RouteEngineInput): RouteContext {
  const isTargetMode = input.target != null;

  const englishScore =
    input.profile.english_test_type && input.profile.english_test_type !== "none"
      ? parseEnglishScore(input.profile.english_test_score)
      : null;

  const hasEnglishSignal = computeHasEnglishSignal(
    input.documents,
    input.testScores,
    { english_test_type: input.profile.english_test_type, english_test_score: input.profile.english_test_score },
    input.today,
  );

  const scope: ScopeItem[] = isTargetMode
    ? [
        {
          applicationId: null,
          universityName: input.target!.universityName,
          status: null,
          applicationDeadline: input.target!.admissionCycle?.applicationDeadline ?? null,
          deadlineTimezone: input.target!.admissionCycle?.deadlineTimezone ?? null,
          applicationDeadlineSource: input.target!.admissionCycle?.applicationDeadlineSource ?? null,
          requirements: input.target!.requirements,
          readiness: computeApplicationReadiness({
            requirements: input.target!.requirements,
            documents: input.documents,
            testScores: input.testScores,
            linkedDocumentIds: input.linkedDocumentIds,
            profile: { english_test_type: input.profile.english_test_type, english_test_score: input.profile.english_test_score },
            today: input.today,
          }),
          eligibilityTier: assessEligibility({ requirements: input.target!.requirements, englishScore }).tier,
          tuitionAmount: input.target!.tuitionAmount,
          tuitionCurrency: input.target!.tuitionCurrency,
          destinationCountryCode: input.target!.destinationCountryCode,
          programStartDate: input.target!.admissionCycle?.programStartDate ?? null,
          orientationDate: input.target!.admissionCycle?.orientationDate ?? null,
          housingDeadline: input.target!.admissionCycle?.housingDeadline ?? null,
          housingMoveInDate: input.target!.admissionCycle?.housingMoveInDate ?? null,
        },
      ]
    : input.applications.map((routeApp) => ({
        applicationId: routeApp.application.id,
        universityName: routeApp.application.university?.name ?? null,
        status: routeApp.application.status,
        applicationDeadline: routeApp.application.admissionCycle?.applicationDeadline ?? null,
        deadlineTimezone: routeApp.application.admissionCycle?.deadlineTimezone ?? null,
        applicationDeadlineSource: routeApp.application.admissionCycle?.applicationDeadlineSource ?? null,
        requirements: routeApp.requirements,
        readiness: routeApp.readiness,
        eligibilityTier: assessEligibility({ requirements: routeApp.requirements, englishScore }).tier,
        tuitionAmount: routeApp.tuitionAmount,
        tuitionCurrency: routeApp.tuitionCurrency,
        destinationCountryCode: routeApp.application.university?.countryCode ?? null,
        programStartDate: routeApp.application.admissionCycle?.programStartDate ?? null,
        orientationDate: routeApp.application.admissionCycle?.orientationDate ?? null,
        housingDeadline: routeApp.application.admissionCycle?.housingDeadline ?? null,
        housingMoveInDate: routeApp.application.admissionCycle?.housingMoveInDate ?? null,
      }));

  const scopedUniversityName = isTargetMode ? input.target!.universityName : null;

  const activeCount = scope.filter((s) => s.status && APPLICATION_ACTIVE_STATUSES.includes(s.status)).length;
  const submittedCount = scope.filter((s) => s.status && SUBMITTED_STATUSES.includes(s.status)).length;
  const acceptedCount = scope.filter((s) => s.status === "accepted").length;
  const hasInterviewSignal = scope.some(
    (s) => s.status === "interview" || s.status === "accepted" || s.status === "rejected",
  );

  let earliestDeadline: { date: string; timezone: string; source: DateSourceInfo | null } | null = null;
  let earliestDeadlineItem: ScopeItem | null = null;
  for (const item of scope) {
    if (!item.applicationDeadline) continue;
    if (!earliestDeadline || item.applicationDeadline < earliestDeadline.date) {
      earliestDeadline = {
        date: item.applicationDeadline,
        timezone: item.deadlineTimezone ?? "UTC",
        source: item.applicationDeadlineSource,
      };
      earliestDeadlineItem = item;
    }
  }

  // Date Engine v2's anchor for Visa/Housing/Travel/Arrival -- prefer a real
  // accepted offer (the destination is fixed); otherwise the same item
  // Application dates are already previewing off of; otherwise nothing to
  // anchor to yet (task brief item 3: never fall back to the application
  // deadline for these domains).
  const acceptedItem = scope.find((s) => s.status === "accepted") ?? null;
  const logisticsSource = acceptedItem ?? earliestDeadlineItem ?? scope[0] ?? null;
  const logistics: LogisticsAnchor | null = logisticsSource
    ? {
        destinationCountryCode: logisticsSource.destinationCountryCode,
        programStartDate: logisticsSource.programStartDate,
        orientationDate: logisticsSource.orientationDate,
        housingDeadline: logisticsSource.housingDeadline,
        housingMoveInDate: logisticsSource.housingMoveInDate,
        source: logisticsSource.applicationDeadlineSource,
        timezone: logisticsSource.deadlineTimezone,
        isAccepted: acceptedItem != null,
      }
    : null;

  const missingDocumentTypes = new Map<DocumentType, string[]>();
  let portfolioRequired = false;
  let portfolioReady = true;
  let entranceExamRequired = false;
  let entranceExamReady = true;
  let entranceExamTestHint: TestType | null = null;
  const computedPercents: number[] = [];

  for (const item of scope) {
    if (item.readiness.status === "computed" && item.readiness.scorePercent != null) {
      computedPercents.push(item.readiness.scorePercent);
    }
    for (const readinessItem of item.readiness.items) {
      if (readinessItem.documentType === "portfolio") {
        portfolioRequired = true;
        if (readinessItem.status !== "ready") portfolioReady = false;
        continue;
      }
      if (
        readinessItem.category === "test" &&
        readinessItem.testHint &&
        readinessItem.testHint !== "english" &&
        ENTRANCE_EXAM_TEST_TYPES.includes(readinessItem.testHint)
      ) {
        entranceExamRequired = true;
        entranceExamTestHint = readinessItem.testHint;
        if (readinessItem.status !== "ready") entranceExamReady = false;
        continue;
      }
      if (readinessItem.status === "missing" && readinessItem.documentType) {
        const names = missingDocumentTypes.get(readinessItem.documentType) ?? [];
        if (item.universityName) names.push(item.universityName);
        missingDocumentTypes.set(readinessItem.documentType, names);
      }
    }
  }

  const readinessAvgPercent =
    computedPercents.length > 0
      ? Math.round(computedPercents.reduce((a, b) => a + b, 0) / computedPercents.length)
      : null;

  const eligibilityCounts = { safety: 0, match: 0, reach: 0, unknown: 0 };
  let reachEnglishTarget: number | null = null;
  let toughestEnglishTarget: number | null = null;
  for (const item of scope) {
    eligibilityCounts[item.eligibilityTier]++;
    const assessment = assessEligibility({ requirements: item.requirements, englishScore });
    if (assessment.englishTarget != null) {
      toughestEnglishTarget =
        toughestEnglishTarget == null ? assessment.englishTarget : Math.max(toughestEnglishTarget, assessment.englishTarget);
    }
    if (item.eligibilityTier === "reach" && assessment.englishTarget != null) {
      reachEnglishTarget =
        reachEnglishTarget == null ? assessment.englishTarget : Math.max(reachEnglishTarget, assessment.englishTarget);
    }
  }

  const inScopeApplicationIds = new Set(scope.map((s) => s.applicationId).filter((id): id is string => Boolean(id)));
  const anyTaskByType = new Map<TaskType, TaskRow[]>();
  const completedTaskTypes = new Set<TaskType>();
  for (const task of input.tasks) {
    if (task.application_id && !inScopeApplicationIds.has(task.application_id)) continue;
    const list = anyTaskByType.get(task.task_type) ?? [];
    list.push(task);
    anyTaskByType.set(task.task_type, list);
    if (task.completed) completedTaskTypes.add(task.task_type);
  }

  return {
    input,
    isTargetMode,
    scopedUniversityName,
    scope,
    englishScore,
    hasEnglishSignal,
    shortlistCount: scope.length,
    activeCount,
    submittedCount,
    acceptedCount,
    earliestDeadline,
    logistics,
    missingDocumentTypes,
    portfolioRequired,
    portfolioReady,
    readinessAvgPercent,
    eligibilityCounts,
    reachEnglishTarget,
    toughestEnglishTarget,
    entranceExamRequired,
    entranceExamReady,
    entranceExamTestHint,
    hasInterviewSignal,
    completedTaskTypes,
    anyTaskByType,
  };
}
