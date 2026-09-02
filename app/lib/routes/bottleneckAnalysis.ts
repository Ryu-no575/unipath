import type { RouteContext } from "./context";
import type { GapAnalysis } from "./gapAnalysis";
import type { RoutePolicy } from "./routePolicies";
import type { Bottleneck, BottleneckSeverity, RouteCapacity, RouteFeasibility } from "./types";

const SEVERITY_RANK: Record<BottleneckSeverity, number> = { critical: 3, high: 2, medium: 1 };

/** Task brief item 9: ranks the real reasons this specific route is hard,
 * from the same GapAnalysis/Feasibility/Capacity numbers already shown
 * elsewhere on the page -- never a generic, route-independent list. Returns
 * at most 3, most severe first. */
export function computeBottlenecks(
  ctx: RouteContext,
  policy: RoutePolicy,
  gap: GapAnalysis,
  feasibility: RouteFeasibility,
  capacity: RouteCapacity,
): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  // See workloadEstimator.ts's identical note: hasGap alone is the right
  // condition -- ctx.hasEnglishSignal is "evidence exists", not "meets the
  // published target", and must not suppress a still-real gap.
  if (gap.english.hasGap) {
    const amount = gap.english.gapAmount ?? 0;
    bottlenecks.push({
      kind: "english_gap",
      severity: amount >= 1 ? "critical" : amount >= 0.5 ? "high" : "medium",
      params: { current: gap.english.current ?? 0, target: gap.english.target ?? 0 },
    });
  }

  if (gap.portfolio.required && !gap.portfolio.ready) {
    bottlenecks.push({
      kind: "portfolio",
      severity: policy.portfolioIterations >= 3 ? "critical" : policy.portfolioIterations >= 2 ? "high" : "medium",
      params: { iterations: policy.portfolioIterations },
    });
  }

  if (gap.entranceExam.required && !gap.entranceExam.ready) {
    const remaining = feasibility.daysUntilDeadline;
    const minNeeded = policy.leadTime.entranceExam.min;
    const severity: BottleneckSeverity =
      remaining != null && remaining - minNeeded < 14 ? "critical" : remaining != null && remaining - minNeeded < 45 ? "high" : "medium";
    bottlenecks.push({ kind: "entrance_exam", severity, params: remaining != null ? { daysRemaining: remaining } : {} });
  }

  if (ctx.missingDocumentTypes.size > 0) {
    bottlenecks.push({
      kind: "document_readiness",
      severity: ctx.missingDocumentTypes.size >= 3 ? "high" : "medium",
      params: { count: ctx.missingDocumentTypes.size },
    });
  }

  // Date Engine v2: Visa no longer has its own application-deadline-anchored
  // lead time (see visaDates.ts) -- this bottleneck is about the Application
  // deadline's own runway, so it uses Application's minimum lead time as the
  // baseline instead.
  if (feasibility.daysUntilDeadline != null && feasibility.daysUntilDeadline < policy.leadTime.application.min) {
    bottlenecks.push({
      kind: "short_lead_time",
      severity: feasibility.daysUntilDeadline < policy.leadTime.application.min / 2 ? "critical" : "high",
      params: { daysRemaining: feasibility.daysUntilDeadline },
    });
  }

  if (capacity.status === "mismatch" && capacity.deficitHoursPerWeek != null) {
    const ratio = capacity.requiredHoursPerWeek > 0 ? capacity.deficitHoursPerWeek / capacity.requiredHoursPerWeek : 0;
    bottlenecks.push({
      kind: "capacity_mismatch",
      severity: ratio >= 0.5 ? "critical" : ratio >= 0.25 ? "high" : "medium",
      params: { deficit: capacity.deficitHoursPerWeek },
    });
  }

  return bottlenecks.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, 3);
}
