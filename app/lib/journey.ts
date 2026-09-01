import type { JourneyStage, TaskType } from "./supabase/database.types";
import type { ApplicationWithDetails } from "./data/applications";
import type { Route, RouteStep, RouteStepType, RouteType } from "./routes/types";
import type { JourneyStepStatus } from "@/app/components/JourneyProgress";

// ---------------------------------------------------------------------------
// Deadline urgency
// ---------------------------------------------------------------------------

export type UrgencyKey =
  | "overdue"
  | "urgent"
  | "important"
  | "prepare"
  | "upcoming"
  | "plenty";

export interface Urgency {
  key: UrgencyKey;
  /** Whole days until due; negative once overdue. */
  days: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getUrgency(dueAt: string | Date, now: Date = new Date()): Urgency {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const days = Math.ceil((due.getTime() - now.getTime()) / MS_PER_DAY);
  return { key: urgencyBucket(days), days };
}

function urgencyBucket(days: number): UrgencyKey {
  if (days < 0) return "overdue";
  if (days <= 6) return "urgent";
  if (days <= 13) return "important";
  if (days <= 29) return "prepare";
  if (days <= 89) return "upcoming";
  return "plenty";
}

// ---------------------------------------------------------------------------
// Task priority (tasks.priority: 1 = High, 2 = Medium, 3 = Low)
// ---------------------------------------------------------------------------

export const TASK_PRIORITIES = [1, 2, 3] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_LABEL_KEYS: Record<TaskPriority, "high" | "medium" | "low"> = {
  1: "high",
  2: "medium",
  3: "low",
};

// ---------------------------------------------------------------------------
// Next Action selection
// ---------------------------------------------------------------------------

export interface NextActionTask {
  id: string;
  title: string;
  taskType: TaskType;
  dueAt: string | null;
  timezone: string;
  priority: number;
  applicationId: string | null;
  completed: boolean;
}

/** Picks the single most important incomplete task: soonest due date first,
 * highest priority (lowest number) as the tiebreaker. Tasks without a due
 * date sort after every task that has one, so when *no* task has a due date
 * the ordering falls through to priority alone. Callers must pre-filter to
 * incomplete tasks. */
export function selectNextAction<T extends NextActionTask>(tasks: T[]): T | null {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return a.priority - b.priority;
  });

  return sorted[0];
}

// ---------------------------------------------------------------------------
// Calendar events (derived from tasks + admission cycle deadlines — no
// separate calendar table, per the "don't duplicate data" requirement)
// ---------------------------------------------------------------------------

/** Where a Calendar entry came from -- task brief item 13. "official" is a
 * verified admission_cycles deadline; "user_created" is a real `tasks` row;
 * "route_generated" is a UniPath-computed suggested date from the user's
 * active Route (see routeCalendarSync.ts) -- never persisted as a task, and
 * always visibly labeled "UniPath Suggested" wherever it's rendered. */
export type CalendarEventOrigin = "official" | "user_created" | "route_generated";

export interface CalendarEvent {
  id: string;
  kind: "task" | "deadline";
  title: string;
  subtitle: string | null;
  category: TaskType;
  dueAt: string;
  timezone: string;
  completed: boolean;
  applicationId: string | null;
  taskId: string | null;
  priority: number | null;
  origin: CalendarEventOrigin;
  /** Set only when origin is "route_generated" -- which active route
   * produced this suggested date (task brief item 13). */
  routeType: RouteType | null;
}

export interface CalendarSourceTask {
  id: string;
  title: string;
  taskType: TaskType;
  dueAt: string | null;
  timezone: string;
  completed: boolean;
  priority: number;
  applicationId: string | null;
}

export function buildCalendarEvents(
  tasks: CalendarSourceTask[],
  applications: ApplicationWithDetails[],
  fallbackUniversityLabel: string,
): CalendarEvent[] {
  const applicationById = new Map(applications.map((a) => [a.id, a]));

  const taskEvents: CalendarEvent[] = tasks
    .filter((task): task is CalendarSourceTask & { dueAt: string } => Boolean(task.dueAt))
    .map((task) => {
      const application = task.applicationId ? applicationById.get(task.applicationId) : null;
      return {
        id: `task-${task.id}`,
        kind: "task",
        title: task.title,
        subtitle: application?.university?.name ?? null,
        category: task.taskType,
        dueAt: task.dueAt,
        timezone: task.timezone,
        completed: task.completed,
        applicationId: task.applicationId,
        taskId: task.id,
        priority: task.priority,
        origin: "user_created",
        routeType: null,
      };
    });

  const deadlineEvents: CalendarEvent[] = applications
    .filter((app) => Boolean(app.admissionCycle?.applicationDeadline))
    .map((app) => {
      const cycle = app.admissionCycle!;
      return {
        id: `deadline-${cycle.id}-${app.id}`,
        kind: "deadline",
        title: app.university?.name ?? fallbackUniversityLabel,
        subtitle: app.program?.name ?? null,
        category: "application",
        dueAt: cycle.applicationDeadline!,
        timezone: cycle.deadlineTimezone ?? "UTC",
        completed: false,
        applicationId: app.id,
        taskId: null,
        priority: null,
        origin: "official",
        routeType: null,
      };
    });

  return [...taskEvents, ...deadlineEvents].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Journey rail statuses for the four post-application stages (Home's "Your
// Journey" rail -- AGENTS.md section 2/13). Deliberately *not* stored: every
// status here is read off the user's already-computed active Route, whose
// steps already carry a real done/current/upcoming status derived from real
// applications/tasks -- never a second, independently-tracked "stage" value
// that could drift from what Routes/Plan already show.
// ---------------------------------------------------------------------------

function findRouteStep(steps: RouteStep[], type: RouteStepType): RouteStep | undefined {
  return steps.find((s) => s.type === type);
}

function singleStepStatus(step: RouteStep | undefined): JourneyStepStatus {
  if (!step) return "comingLater";
  if (step.status === "done") return "done";
  if (step.status === "current") return "inProgress";
  return "notStarted";
}

/** Housing + Travel together ("Move"): done only once both are; in progress
 * as soon as either is done or current (covers an optional backup/multiple
 * step sitting "current" between them); otherwise not yet started. */
function combinedStepStatus(steps: (RouteStep | undefined)[]): JourneyStepStatus {
  const present = steps.filter((s): s is RouteStep => Boolean(s));
  if (present.length === 0) return "comingLater";
  if (present.every((s) => s.status === "done")) return "done";
  if (present.some((s) => s.status === "current" || s.status === "done")) return "inProgress";
  return "notStarted";
}

export interface LateJourneyStatuses {
  funding: JourneyStepStatus;
  visa: JourneyStepStatus;
  move: JourneyStepStatus;
  arrival: JourneyStepStatus;
}

// ---------------------------------------------------------------------------
// Next Action fallback stage resolution -- Persona C/D (AGENTS.md section
// 22): a user who self-reports "I've received an offer" or further should
// still see a Visa/Housing/Move-stage Next Action even before their active
// Route's own currentStep catches up (which only happens once a matching
// application/task exists in UniPath) -- otherwise the fallback would nudge
// them toward an early-stage step that no longer matches where they said
// they are. Never invents progress the other direction: a self-report
// *earlier* than the route's real computed progress is ignored.
// ---------------------------------------------------------------------------

/** Single shared ordering both a RouteStepType and a self-reported
 * JourneyStage are ranked against, so the two are comparable. Anything not
 * explicitly listed (most prep sub-steps) ranks alongside "document". */
const JOURNEY_STAGE_ORDER: RouteStepType[] = [
  "profile",
  "university_search",
  "shortlist",
  "document",
  "application",
  "admission",
  "scholarship",
  "visa",
  "housing",
  "travel",
  "arrival",
];

function routeStepStageRank(type: RouteStepType): number {
  const index = JOURNEY_STAGE_ORDER.indexOf(type);
  return index === -1 ? JOURNEY_STAGE_ORDER.indexOf("document") : index;
}

/** Which RouteStepType each self-reported answer corresponds to -- reused so
 * the fallback CTA's title/href come from the exact same translated labels
 * and routeStepHref map a real route step would use (see labels.ts),
 * instead of a second, separately-worded set of strings. */
const STAGE_REPRESENTATIVE_STEP: Record<JourneyStage, RouteStepType> = {
  exploring: "university_search",
  choosing: "shortlist",
  preparing_applications: "document",
  applied: "application",
  received_offer: "admission",
  preparing_visa: "visa",
  preparing_move: "housing",
  arrived: "arrival",
};

/** Resolves which RouteStepType Home's Next Action fallback should show:
 * the active Route's own currentStep, unless the user self-reported being
 * further along than that step reflects -- returns that self-reported step
 * instead, plus `fromSelfReport: true` so the caller can show a distinct
 * "add your details to unlock full tracking" hint rather than the normal
 * step detail sentence. */
export function resolveNextActionFallbackStep(
  route: Route,
  selfReportedStage: JourneyStage | null,
): { type: RouteStepType; fromSelfReport: boolean } | null {
  const currentType = route.currentStep?.type ?? null;
  if (!selfReportedStage) return currentType ? { type: currentType, fromSelfReport: false } : null;

  const selfReportedStep = STAGE_REPRESENTATIVE_STEP[selfReportedStage];
  const selfReportedRank = routeStepStageRank(selfReportedStep);
  const currentRank = currentType ? routeStepStageRank(currentType) : -1;

  if (selfReportedRank > currentRank) return { type: selfReportedStep, fromSelfReport: true };
  return currentType ? { type: currentType, fromSelfReport: false } : null;
}

export function deriveLateJourneyStatuses(route: Route): LateJourneyStatuses {
  const scholarshipStep = findRouteStep(route.steps, "scholarship");
  const admissionStep = findRouteStep(route.steps, "admission");
  const funding: JourneyStepStatus = scholarshipStep
    ? singleStepStatus(scholarshipStep)
    : admissionStep?.status === "done"
      ? "notStarted"
      : "comingLater";

  // Progressive disclosure (AGENTS.md section 14): visa/housing/travel/
  // arrival steps are always structurally present in a route (buildSteps
  // pushes them unconditionally so their dates are ready the moment they're
  // needed), but they should still read as "comingLater" -- not a real,
  // presently-actionable "notStarted" -- until the user actually has a real
  // application in progress. A still-exploring user with zero applications
  // must never see Visa/Housing crowd their Journey rail as if relevant now.
  const hasApplicationInProgress = Boolean(findRouteStep(route.steps, "application"));
  function lateStatus(step: RouteStep | undefined): JourneyStepStatus {
    if (!hasApplicationInProgress) return "comingLater";
    return singleStepStatus(step);
  }
  function lateCombinedStatus(steps: (RouteStep | undefined)[]): JourneyStepStatus {
    if (!hasApplicationInProgress) return "comingLater";
    return combinedStepStatus(steps);
  }

  return {
    funding,
    visa: lateStatus(findRouteStep(route.steps, "visa")),
    move: lateCombinedStatus([findRouteStep(route.steps, "housing"), findRouteStep(route.steps, "travel")]),
    arrival: lateStatus(findRouteStep(route.steps, "arrival")),
  };
}
