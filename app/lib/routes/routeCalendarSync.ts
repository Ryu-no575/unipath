import type { CalendarEvent } from "@/app/lib/journey";
import { ROUTE_STEP_STYLES } from "./step-style";
import type { Route, RouteStep, RouteStepType, RouteSubStep, RouteType } from "./types";

function categoryFor(type: RouteStepType) {
  return ROUTE_STEP_STYLES[type].taskIconType ?? "other";
}

function toEvent(params: {
  id: string;
  type: RouteStepType;
  title: string;
  suggestedDate: string;
  officialTimezone: string | null;
  universityName: string | null;
  routeType: RouteType;
}): CalendarEvent {
  return {
    id: params.id,
    kind: "task",
    title: params.title,
    subtitle: params.universityName,
    category: categoryFor(params.type),
    dueAt: params.suggestedDate,
    timezone: params.officialTimezone ?? "UTC",
    completed: false,
    applicationId: null,
    taskId: null,
    priority: null,
    origin: "route_generated",
    routeType: params.routeType,
  };
}

function subStepEvents(
  parent: RouteStep,
  subSteps: RouteSubStep[],
  routeType: RouteType,
  universityName: string | null,
  title: string,
): CalendarEvent[] {
  return subSteps
    .filter((s) => !s.done && s.date?.suggestedDate)
    .map((s) =>
      toEvent({
        id: `route-${routeType}-${parent.id}-${s.key}`,
        type: parent.type,
        title,
        suggestedDate: s.date!.suggestedDate!,
        officialTimezone: s.date!.officialTimezone,
        universityName,
        routeType,
      }),
    );
}

/** Turns one active Route's not-yet-done, dated steps into synthetic
 * Calendar entries -- task brief item 11 (mandatory Calendar integration).
 * Never persisted as `tasks` rows: recomputed on every request exactly like
 * the Route itself, so switching routes safely replaces these without
 * touching any real user-created task or the Official Deadline (task brief
 * item 12). Only the parent step's own date is emitted when it has no
 * expanded sub-steps; when it does, the sub-step dates are emitted instead
 * (they're the actually-actionable dates) and the parent's own date is
 * skipped to avoid a duplicate entry on the same day range. */
export function buildRouteSuggestedEvents(
  route: Route,
  labelStepType: (type: RouteStepType) => string,
  universityName: string | null = null,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const step of route.steps) {
    if (step.status === "done") continue;
    const title = labelStepType(step.type);

    if (step.subSteps.length > 0) {
      events.push(...subStepEvents(step, step.subSteps, route.type, universityName, title));
      continue;
    }

    if (step.date?.suggestedDate) {
      events.push(
        toEvent({
          id: `route-${route.type}-${step.id}`,
          type: step.type,
          title,
          suggestedDate: step.date.suggestedDate,
          officialTimezone: step.date.officialTimezone,
          universityName,
          routeType: route.type,
        }),
      );
    }
  }

  return events;
}
