import type {
  ApplicationStatus,
  DocumentType,
  TaskType,
  Database,
} from "@/app/lib/supabase/database.types";
import {
  computeApplicationReadiness,
  hasEnglishSignal as computeHasEnglishSignal,
  type ApplicationReadiness,
} from "@/app/lib/passport/readiness";
import { assessEligibility, type EligibilityTier } from "./eligibility";
import { APPLICATION_ACTIVE_STATUSES, type RouteEngineInput } from "./types";

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
  requirements: AdmissionRequirementRow[];
  readiness: ApplicationReadiness;
  eligibilityTier: EligibilityTier;
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
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
  earliestDeadline: { date: string; timezone: string } | null;
  missingDocumentTypes: Map<DocumentType, string[]>;
  portfolioRequired: boolean;
  portfolioReady: boolean;
  readinessAvgPercent: number | null;
  eligibilityCounts: { safety: number; match: number; reach: number; unknown: number };
  reachEnglishTarget: number | null;
  hasInterviewSignal: boolean;
  completedTaskTypes: Set<TaskType>;
  anyTaskByType: Map<TaskType, TaskRow[]>;
}

const SUBMITTED_STATUSES: ApplicationStatus[] = ["applied", "interview", "accepted", "rejected", "withdrawn"];

function parseEnglishScore(scoreText: string | null): number | null {
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
        },
      ]
    : input.applications.map((routeApp) => ({
        applicationId: routeApp.application.id,
        universityName: routeApp.application.university?.name ?? null,
        status: routeApp.application.status,
        applicationDeadline: routeApp.application.admissionCycle?.applicationDeadline ?? null,
        deadlineTimezone: routeApp.application.admissionCycle?.deadlineTimezone ?? null,
        requirements: routeApp.requirements,
        readiness: routeApp.readiness,
        eligibilityTier: assessEligibility({ requirements: routeApp.requirements, englishScore }).tier,
        tuitionAmount: routeApp.tuitionAmount,
        tuitionCurrency: routeApp.tuitionCurrency,
      }));

  const scopedUniversityName = isTargetMode ? input.target!.universityName : null;

  const activeCount = scope.filter((s) => s.status && APPLICATION_ACTIVE_STATUSES.includes(s.status)).length;
  const submittedCount = scope.filter((s) => s.status && SUBMITTED_STATUSES.includes(s.status)).length;
  const acceptedCount = scope.filter((s) => s.status === "accepted").length;
  const hasInterviewSignal = scope.some(
    (s) => s.status === "interview" || s.status === "accepted" || s.status === "rejected",
  );

  let earliestDeadline: { date: string; timezone: string } | null = null;
  for (const item of scope) {
    if (!item.applicationDeadline) continue;
    if (!earliestDeadline || item.applicationDeadline < earliestDeadline.date) {
      earliestDeadline = { date: item.applicationDeadline, timezone: item.deadlineTimezone ?? "UTC" };
    }
  }

  const missingDocumentTypes = new Map<DocumentType, string[]>();
  let portfolioRequired = false;
  let portfolioReady = true;
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
  for (const item of scope) {
    eligibilityCounts[item.eligibilityTier]++;
    if (item.eligibilityTier === "reach") {
      const assessment = assessEligibility({ requirements: item.requirements, englishScore });
      if (assessment.englishTarget != null) {
        reachEnglishTarget =
          reachEnglishTarget == null ? assessment.englishTarget : Math.max(reachEnglishTarget, assessment.englishTarget);
      }
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
    missingDocumentTypes,
    portfolioRequired,
    portfolioReady,
    readinessAvgPercent,
    eligibilityCounts,
    reachEnglishTarget,
    hasInterviewSignal,
    completedTaskTypes,
    anyTaskByType,
  };
}
