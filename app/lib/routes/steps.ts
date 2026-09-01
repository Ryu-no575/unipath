import type { TaskType, Database } from "@/app/lib/supabase/database.types";
import type { RouteContext } from "./context";
import type { GapAnalysis } from "./gapAnalysis";
import { marginAdjustedTarget } from "./gapAnalysis";
import type { RoutePolicy } from "./routePolicies";
import { backwardPlannedStepDate, planBackwardDate, planSequence } from "./backwardPlanner";
import {
  CALENDAR_LINKED_STEP_TYPES,
  type RouteStep,
  type RouteStepDate,
  type RouteStepLabelParams,
  type RouteStepStatus,
  type RouteStepType,
  type RouteSubStep,
  type RouteSubStepKey,
} from "./types";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

interface RouteStepDraft {
  type: RouteStepType;
  done: boolean;
  labelParams: RouteStepLabelParams;
  date: RouteStepDate | null;
  applicationId: string | null;
  taskId: string | null;
  subSteps: RouteSubStep[];
}

function draft(partial: Omit<RouteStepDraft, "subSteps"> & { subSteps?: RouteSubStep[] }): RouteStepDraft {
  return { subSteps: [], ...partial };
}

function deadlineISO(ctx: RouteContext): string | null {
  return ctx.earliestDeadline?.date ?? null;
}

function deadlineTimezone(ctx: RouteContext): string | null {
  return ctx.earliestDeadline?.timezone ?? null;
}

/** The one place every date on every step/sub-step comes from -- backward
 * planning from the real, verified deadline using this route's own policy
 * (task brief item 3/4). Returns null (never a fabricated date) when there
 * is no verified deadline yet (task brief item 16). */
function plannedDate(
  ctx: RouteContext,
  policy: RoutePolicy,
  range: { min: number; max: number },
  bufferDays = 0,
): RouteStepDate | null {
  return backwardPlannedStepDate({
    today: ctx.input.today,
    deadlineISO: deadlineISO(ctx),
    timezone: deadlineTimezone(ctx),
    range,
    aggressiveness: policy.aggressiveness,
    bufferDays,
  });
}

function subStepDate(ctx: RouteContext, iso: string): RouteStepDate {
  return {
    officialDate: deadlineISO(ctx),
    officialTimezone: deadlineTimezone(ctx),
    suggestedDate: iso,
    suggestedSource: "unipath",
  };
}

function subStep(key: RouteSubStepKey, iso: string | null, ctx: RouteContext, labelParams: RouteStepLabelParams = {}): RouteSubStep {
  return { key, done: false, date: iso ? subStepDate(ctx, iso) : null, labelParams };
}

/** Places `keys.length` milestones between (deadline - range.max - buffer)
 * and (deadline - range.min - buffer). Null when there's no deadline yet --
 * every sub-step is then undated, matching the parent step (task brief item
 * 16's "sequence only"). */
function plannedSequenceSteps(
  ctx: RouteContext,
  range: { min: number; max: number },
  bufferDays: number,
  keys: RouteSubStepKey[],
  labelParamsFor: (index: number) => RouteStepLabelParams = () => ({}),
): RouteSubStep[] {
  const deadline = deadlineISO(ctx);
  if (!deadline) return keys.map((key, i) => subStep(key, null, ctx, labelParamsFor(i)));

  const startISO = planBackwardDate({
    today: ctx.input.today,
    deadlineISO: deadline,
    range: { min: range.max, max: range.max },
    aggressiveness: 0,
    bufferDays,
  });
  const endISO = planBackwardDate({
    today: ctx.input.today,
    deadlineISO: deadline,
    range: { min: range.min, max: range.min },
    aggressiveness: 0,
    bufferDays,
  });
  if (!startISO || !endISO) return keys.map((key, i) => subStep(key, null, ctx, labelParamsFor(i)));

  const dates = planSequence(startISO, endISO, keys.length);
  return keys.map((key, i) => subStep(key, dates[i], ctx, labelParamsFor(i)));
}

function taskDrivenDate(ctx: RouteContext, type: TaskType): { date: RouteStepDate | null; taskId: string | null } {
  const tasks = ctx.anyTaskByType.get(type) ?? [];
  const withDue = tasks
    .filter((t): t is TaskRow & { due_at: string } => Boolean(t.due_at))
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  if (withDue.length === 0) {
    return { date: null, taskId: tasks[0]?.id ?? null };
  }
  const task = withDue[0];
  return {
    date: { officialDate: null, officialTimezone: null, suggestedDate: task.due_at, suggestedSource: "task" },
    taskId: task.id,
  };
}

function representativeTask(ctx: RouteContext, type: TaskType): TaskRow | null {
  const tasks = ctx.anyTaskByType.get(type) ?? [];
  return tasks.find((t) => !t.completed) ?? tasks[0] ?? null;
}

// ---------------------------------------------------------------------------
// Core lifecycle steps -- shared by every route (task brief item 5's
// "Fastest = the minimum every route needs": Eligibility, Documents,
// Application, Visa, Housing, Travel).
// ---------------------------------------------------------------------------

function buildProfileStep(ctx: RouteContext): RouteStepDraft {
  return draft({
    type: "profile",
    done: Boolean(ctx.input.profile.onboarding_completed),
    labelParams: {},
    date: null,
    applicationId: null,
    taskId: null,
  });
}

function buildLanguageTestStep(ctx: RouteContext, policy: RoutePolicy, gap: GapAnalysis): RouteStepDraft {
  const target = marginAdjustedTarget(gap.english, policy.languageMarginBand);
  const done = ctx.hasEnglishSignal && !(policy.steps.languageImprovementPlan && gap.english.hasGap);

  const subSteps =
    policy.steps.languageImprovementPlan && gap.english.hasGap && !done
      ? plannedSequenceSteps(ctx, policy.leadTime.english, policy.bufferDays, [
          "diagnostic_test",
          "vocab_grammar",
          "reading_practice",
          "listening_practice",
          "writing_practice",
          "speaking_practice",
          "mock_test",
          "weakness_review",
          "official_test",
        ])
      : [];

  return draft({
    type: "language_test",
    done,
    labelParams: {
      targetScore: target != null ? String(target) : null,
      currentScore: ctx.englishScore != null ? String(ctx.englishScore) : null,
    },
    date: plannedDate(ctx, policy, policy.leadTime.english, policy.bufferDays),
    applicationId: null,
    taskId: null,
    subSteps,
  });
}

function buildAcademicImprovementStep(ctx: RouteContext, policy: RoutePolicy, gap: GapAnalysis): RouteStepDraft | null {
  if (!policy.steps.academicImprovement || gap.reachCount === 0) return null;
  return draft({
    type: "academic_improvement",
    done: false,
    labelParams: { reachCount: gap.reachCount },
    date: plannedDate(ctx, policy, policy.leadTime.essay, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildEntranceExamStep(ctx: RouteContext, policy: RoutePolicy, gap: GapAnalysis): RouteStepDraft | null {
  if (!gap.entranceExam.required) return null;

  const subSteps = policy.steps.entranceExamPrepPlan
    ? plannedSequenceSteps(ctx, policy.leadTime.entranceExam, policy.bufferDays, [
        "exam_study_plan",
        "exam_topic_preparation",
        "exam_practice_questions",
        "exam_mock_exam",
        "exam_final_review",
        "exam_sitting",
      ])
    : [];

  return draft({
    type: "entrance_exam",
    done: gap.entranceExam.ready,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.entranceExam, policy.bufferDays),
    applicationId: null,
    taskId: null,
    subSteps,
  });
}

function buildSearchStep(ctx: RouteContext): RouteStepDraft | null {
  if (ctx.isTargetMode || ctx.shortlistCount > 0) return null;
  return draft({ type: "university_search", done: false, labelParams: {}, date: null, applicationId: null, taskId: null });
}

function buildBackupUniversitiesStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.backupUniversities || ctx.isTargetMode) return null;
  const safetyTarget = Math.max(2, Math.round(policy.shortlistTarget * 0.3));
  return draft({
    type: "backup_universities",
    done: ctx.eligibilityCounts.safety >= safetyTarget,
    labelParams: { count: ctx.eligibilityCounts.safety, targetCount: safetyTarget },
    date: null,
    applicationId: null,
    taskId: null,
  });
}

function buildShortlistStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (ctx.isTargetMode) return null;
  return draft({
    type: "shortlist",
    done: ctx.shortlistCount >= policy.shortlistTarget,
    labelParams: {
      count: ctx.shortlistCount,
      targetCount: policy.shortlistTarget,
      ...(policy.includeShortlistClassification
        ? {
            safetyCount: ctx.eligibilityCounts.safety,
            matchCount: ctx.eligibilityCounts.match,
            reachCount: ctx.eligibilityCounts.reach,
            unclassifiedCount: ctx.eligibilityCounts.unknown,
          }
        : {}),
    },
    date: null,
    applicationId: null,
    taskId: null,
  });
}

// ---------------------------------------------------------------------------
// Budget-only cost-planning steps (task brief item 5)
// ---------------------------------------------------------------------------

function buildScholarshipResearchStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.budgetSteps) return null;
  return draft({
    type: "scholarship_research",
    done: ctx.completedTaskTypes.has("scholarship"),
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.scholarship, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildTuitionComparisonStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.budgetSteps) return null;
  return draft({
    type: "tuition_comparison",
    done: false,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.scholarship, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildCostOfLivingStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.budgetSteps) return null;
  return draft({
    type: "cost_of_living",
    done: false,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.scholarship, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildAffordableHousingStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.budgetSteps) return null;
  return draft({
    type: "affordable_housing",
    done: ctx.completedTaskTypes.has("housing"),
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.housing, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildFlightMonitoringStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.budgetSteps) return null;
  return draft({
    type: "flight_monitoring",
    done: ctx.completedTaskTypes.has("travel"),
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.housing, 0),
    applicationId: null,
    taskId: null,
  });
}

// ---------------------------------------------------------------------------
// Documents / portfolio / essay refinement
// ---------------------------------------------------------------------------

const ESSAY_DOCUMENT_TYPES = new Set(["motivation_letter", "personal_statement"]);

function buildDocumentSteps(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft[] {
  const steps: RouteStepDraft[] = [];
  for (const [documentType, universityNames] of ctx.missingDocumentTypes) {
    const essaySubSteps =
      policy.steps.essayRefinementCycles && ESSAY_DOCUMENT_TYPES.has(documentType)
        ? plannedSequenceSteps(ctx, policy.leadTime.essay, policy.bufferDays, [
            "essay_draft",
            "essay_feedback",
            "essay_revise",
            "essay_final",
          ])
        : [];
    steps.push(
      draft({
        type: "document",
        done: false,
        labelParams: { documentType, universityName: universityNames[0] ?? null, count: universityNames.length },
        date: plannedDate(ctx, policy, policy.leadTime.document, policy.bufferDays),
        applicationId: null,
        taskId: null,
        subSteps: essaySubSteps,
      }),
    );
  }
  const anyTrackable = ctx.scope.some((s) => s.readiness.status === "computed" && s.readiness.trackableCount > 0);
  if (steps.length === 0 && anyTrackable) {
    steps.push(draft({ type: "document", done: true, labelParams: {}, date: null, applicationId: null, taskId: null }));
  }
  return steps;
}

function buildDocumentVerificationStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.documentVerification) return null;
  return draft({
    type: "document_verification",
    done: false,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.document, policy.bufferDays + 7),
    applicationId: null,
    taskId: null,
  });
}

/** research -> concept -> (draft -> feedback) * (iterations-1) -> draft -> final.
 * Also returns each entry's iteration number (1-based; 0 for the fixed
 * research/concept/final bookends) so the label can say "Portfolio v{n}". */
function portfolioIterationPlan(iterations: number): { key: RouteSubStepKey; iteration: number }[] {
  const plan: { key: RouteSubStepKey; iteration: number }[] = [
    { key: "portfolio_research", iteration: 0 },
    { key: "portfolio_concept", iteration: 0 },
  ];
  for (let i = 1; i <= iterations; i++) {
    plan.push({ key: "portfolio_draft", iteration: i });
    if (i < iterations) plan.push({ key: "portfolio_feedback", iteration: i });
  }
  plan.push({ key: "portfolio_final", iteration: 0 });
  return plan;
}

function buildPortfolioStep(ctx: RouteContext, policy: RoutePolicy, gap: GapAnalysis): RouteStepDraft | null {
  if (!gap.portfolio.required) return null;

  const subSteps =
    policy.portfolioIterations >= 2
      ? (() => {
          const plan = portfolioIterationPlan(policy.portfolioIterations);
          return plannedSequenceSteps(
            ctx,
            policy.leadTime.portfolio,
            policy.bufferDays,
            plan.map((p) => p.key),
            (index) => (plan[index].iteration > 0 ? { iteration: plan[index].iteration } : {}),
          );
        })()
      : [];

  return draft({
    type: "portfolio",
    done: gap.portfolio.ready,
    labelParams: { count: policy.portfolioIterations },
    date: plannedDate(ctx, policy, policy.leadTime.portfolio, policy.bufferDays),
    applicationId: null,
    taskId: null,
    subSteps,
  });
}

// ---------------------------------------------------------------------------
// Application / scholarship / interview / admission / payment
// ---------------------------------------------------------------------------

function buildApplicationStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (ctx.scope.length === 0) return null;
  if (ctx.isTargetMode) {
    return draft({
      type: "application",
      done: false,
      labelParams: { universityName: ctx.scopedUniversityName },
      date: plannedDate(ctx, policy, { min: 0, max: 0 }),
      applicationId: null,
      taskId: null,
    });
  }
  return draft({
    type: "application",
    done: ctx.submittedCount >= ctx.scope.length,
    labelParams: { submittedCount: ctx.submittedCount, totalCount: ctx.scope.length },
    date: plannedDate(ctx, policy, { min: 0, max: 0 }),
    applicationId: null,
    taskId: null,
  });
}

function buildEarlySubmissionStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.earlySubmission || ctx.scope.length === 0) return null;
  return draft({
    type: "early_submission",
    done: ctx.isTargetMode ? false : ctx.submittedCount >= ctx.scope.length,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.application, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildScholarshipStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft {
  const rep = representativeTask(ctx, "scholarship");
  return draft({
    type: "scholarship",
    done: ctx.completedTaskTypes.has("scholarship"),
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.scholarship, policy.bufferDays),
    applicationId: rep?.application_id ?? null,
    taskId: rep?.id ?? null,
  });
}

function buildInterviewStep(ctx: RouteContext): RouteStepDraft | null {
  const hasTaskSignal = (ctx.anyTaskByType.get("interview")?.length ?? 0) > 0;
  if (!ctx.hasInterviewSignal && !hasTaskSignal) return null;
  const rep = representativeTask(ctx, "interview");
  const { date, taskId } = taskDrivenDate(ctx, "interview");
  return draft({
    type: "interview",
    done: ctx.completedTaskTypes.has("interview") || ctx.scope.some((s) => s.status === "accepted" || s.status === "rejected"),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  });
}

function buildAdmissionStep(ctx: RouteContext): RouteStepDraft | null {
  if (ctx.scope.length === 0) return null;
  return draft({ type: "admission", done: ctx.acceptedCount > 0, labelParams: {}, date: null, applicationId: null, taskId: null });
}

function buildPaymentStep(ctx: RouteContext): RouteStepDraft | null {
  const hasTaskSignal = (ctx.anyTaskByType.get("payment")?.length ?? 0) > 0;
  if (ctx.acceptedCount === 0 && !hasTaskSignal) return null;
  const rep = representativeTask(ctx, "payment");
  const { date, taskId } = taskDrivenDate(ctx, "payment");
  return draft({
    type: "payment",
    done: ctx.completedTaskTypes.has("payment"),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  });
}

// ---------------------------------------------------------------------------
// Visa / housing / travel / arrival
// ---------------------------------------------------------------------------

/** Visa/housing/travel prefer a real task's own due_at (task brief pattern
 * shared with Interview/Payment above); when the user hasn't created that
 * task yet, they fall back to this route's own backward-planned date so they
 * show up on /calendar and the Visa/Housing/Travel timelines from day one,
 * same as every other step -- never left undated just because no task
 * exists (closes the gap Ambitious/Budget's backup/affordable variants
 * already avoided by calling plannedDate() themselves). Travel has no
 * dedicated lead time; it reuses housing's, matching buildFlightMonitoringStep. */
function buildTaskDrivenStep(
  ctx: RouteContext,
  policy: RoutePolicy,
  type: "visa" | "housing" | "travel",
): RouteStepDraft {
  const rep = representativeTask(ctx, type);
  const { date: taskDate, taskId } = taskDrivenDate(ctx, type);
  const leadTime = type === "housing" || type === "travel" ? policy.leadTime.housing : policy.leadTime.visa;
  const date = taskDate ?? plannedDate(ctx, policy, leadTime, policy.bufferDays);
  return draft({
    type,
    done: ctx.completedTaskTypes.has(type),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  });
}

function buildBackupVisaStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.backupVisa) return null;
  return draft({
    type: "backup_visa",
    done: false,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.visa, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildMultipleHousingStep(ctx: RouteContext, policy: RoutePolicy): RouteStepDraft | null {
  if (!policy.steps.multipleHousing) return null;
  return draft({
    type: "multiple_housing",
    done: false,
    labelParams: {},
    date: plannedDate(ctx, policy, policy.leadTime.housing, policy.bufferDays),
    applicationId: null,
    taskId: null,
  });
}

function buildArrivalStep(ctx: RouteContext): RouteStepDraft {
  const rep = representativeTask(ctx, "enrollment");
  const { date, taskId } = taskDrivenDate(ctx, "enrollment");
  return draft({
    type: "arrival",
    done: ctx.completedTaskTypes.has("enrollment"),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  });
}

/** Builds one route's ordered Step list from real data + this route's own
 * Policy and Gap Analysis. Every route calls this same orchestrator -- the
 * difference between Fastest/Safest/Budget/Ambitious/Balanced is which
 * optional steps `policy.steps` turns on, each route's own lead-time
 * ranges, and the real gap being closed -- never a hand-written per-route
 * step array (task brief item 5). */
export function buildSteps(ctx: RouteContext, policy: RoutePolicy, gap: GapAnalysis): RouteStep[] {
  const drafts: RouteStepDraft[] = [buildProfileStep(ctx)];

  const academic = buildAcademicImprovementStep(ctx, policy, gap);
  if (academic) drafts.push(academic);

  drafts.push(buildLanguageTestStep(ctx, policy, gap));

  const entranceExam = buildEntranceExamStep(ctx, policy, gap);
  if (entranceExam) drafts.push(entranceExam);

  const search = buildSearchStep(ctx);
  if (search) drafts.push(search);

  const backupUniversities = buildBackupUniversitiesStep(ctx, policy);
  if (backupUniversities) drafts.push(backupUniversities);

  const shortlist = buildShortlistStep(ctx, policy);
  if (shortlist) drafts.push(shortlist);

  for (const s of [
    buildScholarshipResearchStep(ctx, policy),
    buildTuitionComparisonStep(ctx, policy),
    buildCostOfLivingStep(ctx, policy),
  ]) {
    if (s) drafts.push(s);
  }

  drafts.push(...buildDocumentSteps(ctx, policy));

  const documentVerification = buildDocumentVerificationStep(ctx, policy);
  if (documentVerification) drafts.push(documentVerification);

  const portfolio = buildPortfolioStep(ctx, policy, gap);
  if (portfolio) drafts.push(portfolio);

  const application = buildApplicationStep(ctx, policy);
  if (application) drafts.push(application);

  const earlySubmission = buildEarlySubmissionStep(ctx, policy);
  if (earlySubmission) drafts.push(earlySubmission);

  if (policy.steps.scholarshipStep || (ctx.anyTaskByType.get("scholarship")?.length ?? 0) > 0) {
    drafts.push(buildScholarshipStep(ctx, policy));
  }

  const interview = buildInterviewStep(ctx);
  if (interview) drafts.push(interview);

  const admission = buildAdmissionStep(ctx);
  if (admission) drafts.push(admission);

  const payment = buildPaymentStep(ctx);
  if (payment) drafts.push(payment);

  drafts.push(buildTaskDrivenStep(ctx, policy, "visa"));
  const backupVisa = buildBackupVisaStep(ctx, policy);
  if (backupVisa) drafts.push(backupVisa);

  drafts.push(buildTaskDrivenStep(ctx, policy, "housing"));
  const multipleHousing = buildMultipleHousingStep(ctx, policy);
  if (multipleHousing) drafts.push(multipleHousing);

  const affordableHousing = buildAffordableHousingStep(ctx, policy);
  if (affordableHousing) drafts.push(affordableHousing);

  drafts.push(buildTaskDrivenStep(ctx, policy, "travel"));
  const flightMonitoring = buildFlightMonitoringStep(ctx, policy);
  if (flightMonitoring) drafts.push(flightMonitoring);

  drafts.push(buildArrivalStep(ctx));

  let currentAssigned = false;
  return drafts.map((d, index) => {
    let status: RouteStepStatus;
    if (d.done) {
      status = "done";
    } else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else {
      status = "upcoming";
    }
    return {
      id: `${d.type}-${index}`,
      type: d.type,
      status,
      labelParams: d.labelParams,
      date: d.date,
      applicationId: d.applicationId,
      taskId: d.taskId,
      calendarLinked: CALENDAR_LINKED_STEP_TYPES.includes(d.type),
      subSteps: d.subSteps,
    };
  });
}
