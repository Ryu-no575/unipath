import type { TaskType, Database } from "@/app/lib/supabase/database.types";
import { assessEligibility } from "./eligibility";
import type { RouteContext } from "./context";
import {
  CALENDAR_LINKED_STEP_TYPES,
  type RouteStep,
  type RouteStepDate,
  type RouteStepLabelParams,
  type RouteStepStatus,
  type RouteStepType,
} from "./types";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export interface RouteStepParams {
  shortlistTarget: number;
  /** Days before the earliest known official deadline that UniPath suggests
   * having documents/the application itself ready -- a UniPath policy
   * choice (like passport/tasks.ts's PREPARATION_LEAD_DAYS), never a guess
   * at an unknown official date. */
  suggestedLeadDays: number;
  includeScholarshipStep: boolean;
  includeShortlistClassification: boolean;
  /** Ambitious only: surface an explicit "improve your score" step (rather
   * than marking language_test done) when a real gap exists against the
   * toughest requirement among the shortlist/target. */
  includeLanguageImprovement: boolean;
}

interface RouteStepDraft {
  type: RouteStepType;
  done: boolean;
  labelParams: RouteStepLabelParams;
  date: RouteStepDate | null;
  applicationId: string | null;
  taskId: string | null;
}

function deadlineDrivenDate(ctx: RouteContext, leadDays: number): RouteStepDate | null {
  if (!ctx.earliestDeadline) return null;
  const parsed = new Date(ctx.earliestDeadline.date);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() - leadDays);
  return {
    officialDate: ctx.earliestDeadline.date,
    officialTimezone: ctx.earliestDeadline.timezone,
    suggestedDate: parsed.toISOString(),
    suggestedSource: "unipath",
  };
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

function buildProfileStep(ctx: RouteContext): RouteStepDraft {
  return {
    type: "profile",
    done: Boolean(ctx.input.profile.onboarding_completed),
    labelParams: {},
    date: null,
    applicationId: null,
    taskId: null,
  };
}

function buildLanguageTestStep(ctx: RouteContext, params: RouteStepParams): RouteStepDraft {
  let target: number | null = null;
  for (const item of ctx.scope) {
    const assessment = assessEligibility({ requirements: item.requirements, englishScore: ctx.englishScore });
    if (assessment.englishTarget != null) {
      target = target == null ? assessment.englishTarget : Math.max(target, assessment.englishTarget);
    }
  }
  const gapExists = target != null && ctx.englishScore != null && ctx.englishScore < target;
  const done = ctx.hasEnglishSignal && !(params.includeLanguageImprovement && gapExists);

  return {
    type: "language_test",
    done,
    labelParams: {
      targetScore: target != null ? String(target) : null,
      currentScore: ctx.englishScore != null ? String(ctx.englishScore) : null,
    },
    date: deadlineDrivenDate(ctx, params.suggestedLeadDays + 60),
    applicationId: null,
    taskId: null,
  };
}

function buildSearchStep(ctx: RouteContext): RouteStepDraft | null {
  if (ctx.isTargetMode || ctx.shortlistCount > 0) return null;
  return { type: "university_search", done: false, labelParams: {}, date: null, applicationId: null, taskId: null };
}

function buildShortlistStep(ctx: RouteContext, params: RouteStepParams): RouteStepDraft | null {
  if (ctx.isTargetMode) return null;
  return {
    type: "shortlist",
    done: ctx.shortlistCount >= params.shortlistTarget,
    labelParams: {
      count: ctx.shortlistCount,
      targetCount: params.shortlistTarget,
      ...(params.includeShortlistClassification
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
  };
}

function buildDocumentSteps(ctx: RouteContext, params: RouteStepParams): RouteStepDraft[] {
  const steps: RouteStepDraft[] = [];
  for (const [documentType, universityNames] of ctx.missingDocumentTypes) {
    steps.push({
      type: "document",
      done: false,
      labelParams: { documentType, universityName: universityNames[0] ?? null, count: universityNames.length },
      date: deadlineDrivenDate(ctx, params.suggestedLeadDays),
      applicationId: null,
      taskId: null,
    });
  }
  const anyTrackable = ctx.scope.some((s) => s.readiness.status === "computed" && s.readiness.trackableCount > 0);
  if (steps.length === 0 && anyTrackable) {
    steps.push({ type: "document", done: true, labelParams: {}, date: null, applicationId: null, taskId: null });
  }
  return steps;
}

function buildPortfolioStep(ctx: RouteContext, params: RouteStepParams): RouteStepDraft | null {
  if (!ctx.portfolioRequired) return null;
  return {
    type: "portfolio",
    done: ctx.portfolioReady,
    labelParams: {},
    date: deadlineDrivenDate(ctx, params.suggestedLeadDays),
    applicationId: null,
    taskId: null,
  };
}

function buildApplicationStep(ctx: RouteContext): RouteStepDraft | null {
  if (ctx.scope.length === 0) return null;
  if (ctx.isTargetMode) {
    return {
      type: "application",
      done: false,
      labelParams: { universityName: ctx.scopedUniversityName },
      date: deadlineDrivenDate(ctx, 0),
      applicationId: null,
      taskId: null,
    };
  }
  return {
    type: "application",
    done: ctx.submittedCount >= ctx.scope.length,
    labelParams: { submittedCount: ctx.submittedCount, totalCount: ctx.scope.length },
    date: deadlineDrivenDate(ctx, 0),
    applicationId: null,
    taskId: null,
  };
}

function buildScholarshipStep(ctx: RouteContext): RouteStepDraft {
  const rep = representativeTask(ctx, "scholarship");
  return {
    type: "scholarship",
    done: ctx.completedTaskTypes.has("scholarship"),
    labelParams: {},
    date: null,
    applicationId: rep?.application_id ?? null,
    taskId: rep?.id ?? null,
  };
}

function buildInterviewStep(ctx: RouteContext): RouteStepDraft | null {
  const hasTaskSignal = (ctx.anyTaskByType.get("interview")?.length ?? 0) > 0;
  if (!ctx.hasInterviewSignal && !hasTaskSignal) return null;
  const rep = representativeTask(ctx, "interview");
  const { date, taskId } = taskDrivenDate(ctx, "interview");
  return {
    type: "interview",
    done: ctx.completedTaskTypes.has("interview") || ctx.scope.some((s) => s.status === "accepted" || s.status === "rejected"),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  };
}

function buildAdmissionStep(ctx: RouteContext): RouteStepDraft | null {
  if (ctx.scope.length === 0) return null;
  return { type: "admission", done: ctx.acceptedCount > 0, labelParams: {}, date: null, applicationId: null, taskId: null };
}

function buildPaymentStep(ctx: RouteContext): RouteStepDraft | null {
  const hasTaskSignal = (ctx.anyTaskByType.get("payment")?.length ?? 0) > 0;
  if (ctx.acceptedCount === 0 && !hasTaskSignal) return null;
  const rep = representativeTask(ctx, "payment");
  const { date, taskId } = taskDrivenDate(ctx, "payment");
  return {
    type: "payment",
    done: ctx.completedTaskTypes.has("payment"),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  };
}

function buildTaskDrivenStep(ctx: RouteContext, type: "visa" | "housing" | "travel"): RouteStepDraft {
  const rep = representativeTask(ctx, type);
  const { date, taskId } = taskDrivenDate(ctx, type);
  return {
    type,
    done: ctx.completedTaskTypes.has(type),
    labelParams: {},
    date,
    applicationId: rep?.application_id ?? null,
    taskId: taskId ?? rep?.id ?? null,
  };
}

function buildArrivalStep(ctx: RouteContext): RouteStepDraft {
  const rep = representativeTask(ctx, "enrollment");
  return {
    type: "arrival",
    done: ctx.completedTaskTypes.has("enrollment"),
    labelParams: {},
    date: null,
    applicationId: rep?.application_id ?? null,
    taskId: rep?.id ?? null,
  };
}

/** Builds one route's ordered Step list from real data + the route's own
 * parameters. Every route calls this same function -- the difference between
 * Fastest/Safest/Budget/Ambitious/Balanced is entirely in `params` (see
 * app/lib/routes/{fastest,safest,budget,ambitious,balanced}Route.ts), never
 * in hand-written per-route step lists. */
export function buildSteps(ctx: RouteContext, params: RouteStepParams): RouteStep[] {
  const drafts: RouteStepDraft[] = [buildProfileStep(ctx), buildLanguageTestStep(ctx, params)];

  const search = buildSearchStep(ctx);
  if (search) drafts.push(search);
  const shortlist = buildShortlistStep(ctx, params);
  if (shortlist) drafts.push(shortlist);

  drafts.push(...buildDocumentSteps(ctx, params));

  const portfolio = buildPortfolioStep(ctx, params);
  if (portfolio) drafts.push(portfolio);

  const application = buildApplicationStep(ctx);
  if (application) drafts.push(application);

  if (params.includeScholarshipStep || (ctx.anyTaskByType.get("scholarship")?.length ?? 0) > 0) {
    drafts.push(buildScholarshipStep(ctx));
  }

  const interview = buildInterviewStep(ctx);
  if (interview) drafts.push(interview);

  const admission = buildAdmissionStep(ctx);
  if (admission) drafts.push(admission);

  const payment = buildPaymentStep(ctx);
  if (payment) drafts.push(payment);

  drafts.push(buildTaskDrivenStep(ctx, "visa"));
  drafts.push(buildTaskDrivenStep(ctx, "housing"));
  drafts.push(buildTaskDrivenStep(ctx, "travel"));
  drafts.push(buildArrivalStep(ctx));

  let currentAssigned = false;
  return drafts.map((draft, index) => {
    let status: RouteStepStatus;
    if (draft.done) {
      status = "done";
    } else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else {
      status = "upcoming";
    }
    return {
      id: `${draft.type}-${index}`,
      type: draft.type,
      status,
      labelParams: draft.labelParams,
      date: draft.date,
      applicationId: draft.applicationId,
      taskId: draft.taskId,
      calendarLinked: CALENDAR_LINKED_STEP_TYPES.includes(draft.type),
    };
  });
}
