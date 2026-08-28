import type { TestType } from "@/app/lib/supabase/database.types";
import type { RouteContext } from "./context";

export interface EnglishGap {
  current: number | null;
  /** The toughest published minimum across the whole shortlist/target --
   * never a margin-adjusted number; see `marginAdjustedTarget` for that. */
  target: number | null;
  hasGap: boolean;
  gapAmount: number | null;
}

export interface PortfolioGap {
  required: boolean;
  ready: boolean;
}

export interface EntranceExamGap {
  required: boolean;
  ready: boolean;
  testHint: TestType | null;
}

/** Current Profile vs Target Program Requirements, computed once before a
 * Route is generated and handed to every step/date/reason builder (task
 * brief item 6) -- so "does this route need to close a gap" is answered
 * from the same real numbers everywhere, never re-derived ad hoc per step. */
export interface GapAnalysis {
  english: EnglishGap;
  portfolio: PortfolioGap;
  entranceExam: EntranceExamGap;
  reachCount: number;
}

/** A route's own margin policy (e.g. Ambitious's "+0.5 band") applied on
 * top of the real published target -- the number a route actually asks the
 * user to reach, never the number used to decide whether a gap exists. */
export function marginAdjustedTarget(gap: EnglishGap, marginBand: number): number | null {
  if (gap.target == null) return null;
  return Math.round((gap.target + marginBand) * 100) / 100;
}

export function computeGapAnalysis(ctx: RouteContext): GapAnalysis {
  const target = ctx.toughestEnglishTarget;
  const current = ctx.englishScore;
  const hasGap = target != null && current != null && current < target;

  return {
    english: {
      current,
      target,
      hasGap,
      gapAmount: hasGap ? Math.round((target! - current!) * 100) / 100 : null,
    },
    portfolio: {
      required: ctx.portfolioRequired,
      ready: ctx.portfolioReady,
    },
    entranceExam: {
      required: ctx.entranceExamRequired,
      ready: ctx.entranceExamReady,
      testHint: ctx.entranceExamTestHint,
    },
    reachCount: ctx.eligibilityCounts.reach,
  };
}
