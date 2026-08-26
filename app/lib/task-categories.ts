import type { TaskType } from "./supabase/database.types";

export const TASK_TYPES: TaskType[] = [
  "application",
  "document",
  "test",
  "recommendation",
  "scholarship",
  "interview",
  "payment",
  "visa",
  "housing",
  "travel",
  "enrollment",
  "other",
];

export interface CategoryStyle {
  /** Resolved against the "TaskTypeOptions" i18n namespace. */
  labelKey: TaskType;
  badgeClass: string;
  dotClass: string;
}

// Every category pairs a distinct color AND a distinct icon (see
// CategoryIcon.tsx) AND a text label — never color alone, so the calendar
// and task lists stay legible for colorblind users and in text-only
// contexts (screen readers).
export const TASK_CATEGORY_STYLES: Record<TaskType, CategoryStyle> = {
  application: {
    labelKey: "application",
    badgeClass: "bg-blue-50 text-blue-700",
    dotClass: "bg-blue-500",
  },
  document: {
    labelKey: "document",
    badgeClass: "bg-zinc-100 text-zinc-700",
    dotClass: "bg-zinc-500",
  },
  test: {
    labelKey: "test",
    badgeClass: "bg-purple-50 text-purple-700",
    dotClass: "bg-purple-500",
  },
  recommendation: {
    labelKey: "recommendation",
    badgeClass: "bg-indigo-50 text-indigo-700",
    dotClass: "bg-indigo-500",
  },
  scholarship: {
    labelKey: "scholarship",
    badgeClass: "bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
  },
  interview: {
    labelKey: "interview",
    badgeClass: "bg-pink-50 text-pink-700",
    dotClass: "bg-pink-500",
  },
  payment: {
    labelKey: "payment",
    badgeClass: "bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  visa: {
    labelKey: "visa",
    badgeClass: "bg-red-50 text-red-700",
    dotClass: "bg-red-500",
  },
  housing: {
    labelKey: "housing",
    badgeClass: "bg-teal-50 text-teal-700",
    dotClass: "bg-teal-500",
  },
  travel: {
    labelKey: "travel",
    badgeClass: "bg-sky-50 text-sky-700",
    dotClass: "bg-sky-500",
  },
  enrollment: {
    labelKey: "enrollment",
    badgeClass: "bg-violet-50 text-violet-700",
    dotClass: "bg-violet-500",
  },
  other: {
    labelKey: "other",
    badgeClass: "bg-zinc-100 text-zinc-600",
    dotClass: "bg-zinc-400",
  },
};

export const URGENCY_STYLES: Record<
  "overdue" | "urgent" | "important" | "prepare" | "upcoming" | "plenty",
  { badgeClass: string }
> = {
  overdue: { badgeClass: "bg-red-100 text-red-800" },
  urgent: { badgeClass: "bg-red-50 text-red-700" },
  important: { badgeClass: "bg-amber-50 text-amber-700" },
  prepare: { badgeClass: "bg-blue-50 text-blue-700" },
  upcoming: { badgeClass: "bg-zinc-100 text-zinc-700" },
  plenty: { badgeClass: "bg-emerald-50 text-emerald-700" },
};
