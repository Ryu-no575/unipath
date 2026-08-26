import type { TaskType } from "./supabase/database.types";
import type { ApplicationWithDetails } from "./data/applications";

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
      };
    });

  return [...taskEvents, ...deadlineEvents].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
}
