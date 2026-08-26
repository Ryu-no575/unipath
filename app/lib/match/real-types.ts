import type { ApplicationType } from "@/app/lib/supabase/database.types";
import type { CountryCode } from "@/app/lib/countries";
import type { MatchTier } from "./types";

/**
 * A real program from `public.programs` joined with its university and (if
 * one exists) its most relevant admission cycle -- never a fictional demo
 * entry (see app/lib/match/demo-catalog.ts for that, which this type has no
 * relationship to). Every field the official source hasn't confirmed is
 * null; the match engine and UI must treat null as "unknown", never as a
 * guessable default.
 */
export interface RealProgramCandidate {
  programId: string;
  universityId: string;
  universityName: string;
  countryCode: CountryCode | null;
  city: string | null;
  officialWebsite: string | null;
  programName: string;
  degreeType: ApplicationType | null;
  field: string | null;
  language: string | null;
  duration: string | null;
  /** Best available official link, already resolved through the Broken URL
   * fallback chain (see app/lib/live-data/officialUrl.ts) -- never a raw,
   * possibly-404 `programs.official_url`. Null only when no usable source or
   * university website exists at all. */
  officialUrl: string | null;
  /** "verified" only when officialUrl was actually confirmed reachable
   * (HTTP 200-299, right domain) by validateSource.ts -- never just because
   * a `sources` row exists (see AGENTS.md task notes on Source Validation). */
  officialUrlStatus: "verified" | "unverified" | "unavailable";
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  applicationDeadline: string | null;
  /** True only when officialUrlStatus is "verified" -- kept as a separate
   * boolean for the simple badge, alongside the richer status above. */
  verified: boolean;
  lastCheckedAt: string | null;
}

export type RealMatchReasonKind =
  | "field_positive"
  | "field_caution"
  | "degree_match"
  | "location_within"
  | "location_outside"
  | "budget_within"
  | "budget_over"
  | "budget_unknown";

export interface RealMatchReason {
  marker: "positive" | "caution";
  kind: RealMatchReasonKind;
}

export interface RealMatchResult {
  candidate: RealProgramCandidate;
  scorePercent: number;
  tier: MatchTier;
  reasons: RealMatchReason[];
}

export interface RealMatchComputation {
  /** Every verified-catalog candidate that passed the hard constraints, sorted by score desc. */
  results: RealMatchResult[];
  /** Total real programs in the catalog, regardless of hard constraints -- used for
   * "We currently have verified data for X programs" messaging. */
  totalVerifiedPrograms: number;
  excludedCount: number;
}
