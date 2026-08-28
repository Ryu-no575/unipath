import type { RouteContext } from "./context";
import type { RoutePolicy } from "./routePolicies";
import type { RouteType } from "./types";
import type { RouteUniversityCandidate, RouteUniversityCandidateReason } from "./types";
import type { RealMatchResult } from "@/app/lib/match/real-types";

function toCandidate(result: RealMatchResult, reasonKind: RouteUniversityCandidateReason): RouteUniversityCandidate {
  return {
    programId: result.candidate.programId,
    universityId: result.candidate.universityId,
    universityName: result.candidate.universityName,
    programName: result.candidate.programName,
    matchScorePercent: result.scorePercent,
    tuitionAmount: result.candidate.tuitionAmount,
    tuitionCurrency: result.candidate.tuitionCurrency,
    applicationDeadline: result.candidate.applicationDeadline,
    reasonKind,
  };
}

/** Task brief item 12: picks a genuinely different slate of real, verified
 * programs per route type from the same match candidate pool
 * (ctx.input.matchResults -- see app/lib/data/routes.ts, real programs only,
 * never the fictional demo catalog). Never touches the user's own
 * applications (those already drive `steps.ts`/`gapAnalysis.ts` directly) --
 * this is additive "you could also consider" input, and is explicitly
 * distinct from Reach/Core/Backup (applicationPortfolio.ts), which only
 * classifies real admission-requirement data the app actually has for the
 * user's *own* shortlist. Returns [] (not a guess) whenever the verified
 * catalog has nothing usable yet -- with today's real data volume this will
 * often be empty, which the UI must render as an honest empty state. */
export function selectUniversityCandidates(ctx: RouteContext, policy: RoutePolicy, type: RouteType): RouteUniversityCandidate[] {
  const alreadyShortlisted = new Set(ctx.scope.map((s) => s.universityName).filter((n): n is string => Boolean(n)));

  const verified = ctx.input.matchResults.filter(
    (r) => r.candidate.verified && !alreadyShortlisted.has(r.candidate.universityName),
  );
  if (verified.length === 0) return [];

  const limit = policy.shortlistTarget;

  switch (type) {
    case "fastest": {
      return [...verified].sort((a, b) => b.scorePercent - a.scorePercent).slice(0, limit).map((r) => toCandidate(r, "top_match"));
    }

    case "safest": {
      const safe = verified.filter((r) => r.tier === "strong" || r.tier === "good");
      return [...safe]
        .sort((a, b) => {
          const aDate = a.candidate.applicationDeadline ?? "";
          const bDate = b.candidate.applicationDeadline ?? "";
          if (aDate !== bDate) return bDate.localeCompare(aDate); // further-out deadline first
          return b.scorePercent - a.scorePercent;
        })
        .slice(0, limit)
        .map((r) => toCandidate(r, "long_buffer"));
    }

    case "budget": {
      const withTuition = verified.filter((r) => r.candidate.tuitionAmount != null);
      return [...withTuition]
        .sort((a, b) => (a.candidate.tuitionAmount ?? 0) - (b.candidate.tuitionAmount ?? 0))
        .slice(0, limit)
        .map((r) => toCandidate(r, "low_tuition"));
    }

    case "ambitious": {
      const strong = [...verified].sort((a, b) => b.scorePercent - a.scorePercent);
      const reachTier = strong.filter((r) => r.tier === "possible" || r.tier === "closest");
      const coreTier = strong.filter((r) => r.tier === "strong" || r.tier === "good");
      const reachSlots = Math.max(1, Math.round(limit * 0.3));
      return [
        ...coreTier.slice(0, limit - reachSlots).map((r) => toCandidate(r, "top_match")),
        ...reachTier.slice(0, reachSlots).map((r) => toCandidate(r, "reach_option")),
      ].slice(0, limit);
    }

    case "balanced":
    default: {
      return [...verified].sort((a, b) => b.scorePercent - a.scorePercent).slice(0, limit).map((r) => toCandidate(r, "top_match"));
    }
  }
}
