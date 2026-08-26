import type { TaskType } from "@/app/lib/supabase/database.types";
import type { RouteStepType } from "./types";

export interface RouteStepStyle {
  badgeClass: string;
  dotClass: string;
  ringClass: string;
  /** When set, CategoryIcon (app/components/calendar/CategoryIcon.tsx)
   * already has the right glyph for this step type -- reused rather than
   * duplicated. Null for the Route-only step types (see RouteStepIcon.tsx). */
  taskIconType: TaskType | null;
}

export const ROUTE_STEP_STYLES: Record<RouteStepType, RouteStepStyle> = {
  profile: {
    badgeClass: "bg-slate-50 text-slate-700",
    dotClass: "bg-slate-500",
    ringClass: "ring-slate-200",
    taskIconType: null,
  },
  language_test: {
    badgeClass: "bg-purple-50 text-purple-700",
    dotClass: "bg-purple-500",
    ringClass: "ring-purple-200",
    taskIconType: "test",
  },
  university_search: {
    badgeClass: "bg-cyan-50 text-cyan-700",
    dotClass: "bg-cyan-500",
    ringClass: "ring-cyan-200",
    taskIconType: null,
  },
  shortlist: {
    badgeClass: "bg-cyan-50 text-cyan-700",
    dotClass: "bg-cyan-500",
    ringClass: "ring-cyan-200",
    taskIconType: null,
  },
  document: {
    badgeClass: "bg-zinc-100 text-zinc-700",
    dotClass: "bg-zinc-500",
    ringClass: "ring-zinc-200",
    taskIconType: "document",
  },
  portfolio: {
    badgeClass: "bg-fuchsia-50 text-fuchsia-700",
    dotClass: "bg-fuchsia-500",
    ringClass: "ring-fuchsia-200",
    taskIconType: null,
  },
  application: {
    badgeClass: "bg-blue-50 text-blue-700",
    dotClass: "bg-blue-500",
    ringClass: "ring-blue-200",
    taskIconType: "application",
  },
  scholarship: {
    badgeClass: "bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
    ringClass: "ring-amber-200",
    taskIconType: "scholarship",
  },
  interview: {
    badgeClass: "bg-pink-50 text-pink-700",
    dotClass: "bg-pink-500",
    ringClass: "ring-pink-200",
    taskIconType: "interview",
  },
  admission: {
    badgeClass: "bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
    ringClass: "ring-emerald-200",
    taskIconType: null,
  },
  payment: {
    badgeClass: "bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
    ringClass: "ring-emerald-200",
    taskIconType: "payment",
  },
  visa: {
    badgeClass: "bg-red-50 text-red-700",
    dotClass: "bg-red-500",
    ringClass: "ring-red-200",
    taskIconType: "visa",
  },
  housing: {
    badgeClass: "bg-teal-50 text-teal-700",
    dotClass: "bg-teal-500",
    ringClass: "ring-teal-200",
    taskIconType: "housing",
  },
  travel: {
    badgeClass: "bg-sky-50 text-sky-700",
    dotClass: "bg-sky-500",
    ringClass: "ring-sky-200",
    taskIconType: "travel",
  },
  arrival: {
    badgeClass: "bg-violet-50 text-violet-700",
    dotClass: "bg-violet-500",
    ringClass: "ring-violet-200",
    taskIconType: "enrollment",
  },
};
