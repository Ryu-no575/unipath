import type { Route, RouteDiffEntry, RouteStepType } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface TypeInfo {
  present: boolean;
  earliestISO: string | null;
  subStepCount: number;
  shortlistTarget: number | null;
}

function collectByType(route: Route): Map<RouteStepType, TypeInfo> {
  const map = new Map<RouteStepType, TypeInfo>();
  for (const step of route.steps) {
    const existing = map.get(step.type) ?? { present: true, earliestISO: null, subStepCount: 0, shortlistTarget: null };
    existing.present = true;
    existing.subStepCount += step.subSteps.length;
    if (step.type === "shortlist" && step.labelParams.targetCount != null) {
      existing.shortlistTarget = step.labelParams.targetCount;
    }
    const candidates = [step.date?.suggestedDate, ...step.subSteps.map((s) => s.date?.suggestedDate)].filter(
      (d): d is string => Boolean(d),
    );
    for (const iso of candidates) {
      if (existing.earliestISO == null || iso < existing.earliestISO) existing.earliestISO = iso;
    }
    map.set(step.type, existing);
  }
  return map;
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(fromISO).getTime() - new Date(toISO).getTime()) / MS_PER_DAY);
}

/** Diffs two already-generated Routes -- "Switching to X route will: ..."
 * (task brief item 9/19). Always computed from the Routes themselves, never
 * a separate hand-written explanation, so it can never drift from what the
 * Route Map and Calendar actually show. */
export function compareRoutes(current: Route, candidate: Route): RouteDiffEntry[] {
  const entries: RouteDiffEntry[] = [];

  if (current.comparison.startsDate && candidate.comparison.startsDate) {
    const diff = daysBetween(current.comparison.startsDate, candidate.comparison.startsDate);
    if (diff >= 3) entries.push({ kind: "starts_earlier", params: { days: diff } });
    else if (diff <= -3) entries.push({ kind: "starts_later", params: { days: -diff } });
  } else if (candidate.comparison.startsDate && !current.comparison.startsDate) {
    entries.push({ kind: "starts_earlier", params: { days: 0 } });
  }

  const currentByType = collectByType(current);
  const candidateByType = collectByType(candidate);
  const allTypes = new Set<RouteStepType>([...currentByType.keys(), ...candidateByType.keys()]);

  for (const type of allTypes) {
    const before = currentByType.get(type);
    const after = candidateByType.get(type);

    if (after?.present && !before?.present) {
      entries.push({ kind: "adds_step", stepType: type });
      continue;
    }
    if (before?.present && !after?.present) {
      entries.push({ kind: "removes_step", stepType: type });
      continue;
    }
    if (!before || !after) continue;

    if (type === "portfolio" && before.subStepCount !== after.subStepCount) {
      const kind = after.subStepCount > before.subStepCount ? "adds_portfolio_iterations" : "removes_portfolio_iterations";
      entries.push({ kind, params: { count: Math.abs(after.subStepCount - before.subStepCount) } });
    }

    if (type === "shortlist" && before.shortlistTarget != null && after.shortlistTarget != null) {
      if (before.shortlistTarget !== after.shortlistTarget) {
        entries.push({ kind: "shortlist_target_change", params: { from: before.shortlistTarget, to: after.shortlistTarget } });
      }
    }

    if (before.earliestISO && after.earliestISO) {
      const diff = daysBetween(before.earliestISO, after.earliestISO);
      if (diff >= 3) entries.push({ kind: "step_moves_earlier", stepType: type, params: { days: diff } });
      else if (diff <= -3) entries.push({ kind: "step_moves_later", stepType: type, params: { days: -diff } });
    }
  }

  return entries.slice(0, 6);
}
