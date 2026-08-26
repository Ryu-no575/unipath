import type {
  ApplicationType,
  CampusEnvironment,
  ClassSizePreference,
  ClimatePreference,
  EnglishTestType,
  PriorityType,
} from "@/app/lib/supabase/database.types";
import type { CountryCode } from "@/app/lib/countries";

export const CAMPUS_ENVIRONMENTS: CampusEnvironment[] = [
  "urban",
  "suburban",
  "rural",
  "no_preference",
];
export const CLASS_SIZE_PREFERENCES: ClassSizePreference[] = [
  "small",
  "medium",
  "large",
  "no_preference",
];
export const CLIMATE_PREFERENCES: ClimatePreference[] = [
  "warm",
  "moderate",
  "cold",
  "no_preference",
];

/** Maps each enum value to its key in the MatchOptions message namespace.
 * Shared by the quiz (as selectable options) and results (to label a
 * candidate's environment/size/climate). */
export const ENVIRONMENT_LABEL_KEYS = {
  urban: "environmentUrban",
  suburban: "environmentSuburban",
  rural: "environmentRural",
  no_preference: "environmentNoPreference",
} as const satisfies Record<CampusEnvironment, string>;

export const CLASS_SIZE_LABEL_KEYS = {
  small: "sizeSmall",
  medium: "sizeMedium",
  large: "sizeLarge",
  no_preference: "sizeNoPreference",
} as const satisfies Record<ClassSizePreference, string>;

export const CLIMATE_LABEL_KEYS = {
  warm: "climateWarm",
  moderate: "climateModerate",
  cold: "climateCold",
  no_preference: "climateNoPreference",
} as const satisfies Record<ClimatePreference, string>;

/** The Match Quiz's own questions -- everything else it needs (destination
 * countries, field of study, degree type, budget, priority weights) already
 * lives on the profile and is only reviewed, not re-asked. */
export interface MatchQuizAnswers {
  campusEnvironment: CampusEnvironment;
  classSizePreference: ClassSizePreference;
  climatePreference: ClimatePreference;
  workWhileStudyingImportance: number;
  scholarshipNeed: boolean;
}

export function defaultMatchQuizAnswers(): MatchQuizAnswers {
  return {
    campusEnvironment: "no_preference",
    classSizePreference: "no_preference",
    climatePreference: "no_preference",
    workWhileStudyingImportance: 3,
    scholarshipNeed: false,
  };
}

/**
 * A fictional university + program used to demonstrate the match engine.
 * None of these are real institutions -- see app/lib/match/demo-catalog.ts.
 * The 1-5 "*Score" fields are hand-authored demo ratings, not real rankings
 * or survey data.
 */
export interface DemoUniversityProgram {
  id: string;
  universityName: string;
  countryCode: CountryCode;
  city: string;
  environment: Exclude<CampusEnvironment, "no_preference">;
  climate: Exclude<ClimatePreference, "no_preference">;
  studentBodySize: Exclude<ClassSizePreference, "no_preference">;
  programName: string;
  degreeType: ApplicationType;
  field: string;
  language: string;
  tuitionAmount: number;
  tuitionCurrency: string;
  livingCostAmount: number;
  livingCostCurrency: string;
  academicQualityScore: number;
  rankingScore: number;
  employmentScore: number;
  safetyScore: number;
  internationalCommunityScore: number;
  researchScore: number;
  campusLifeScore: number;
  workWhileStudyingScore: number;
  scholarshipsAvailable: boolean;
  /** Minimum overall IELTS band the program requires, if any. Demo data
   * only models IELTS -- other English tests are treated as "can't compare"
   * (neutral score) rather than guessed at via a conversion table. */
  minIeltsScore: number | null;
}

/** Score bands used to label each match -- not admission-probability bands,
 * just how closely the candidate fits the user's stated profile/preferences.
 * Below 50% still gets shown (never hard-cut) but as "closest", never with
 * confidence-implying language like "good" or "strong". */
export type MatchTier = "strong" | "good" | "possible" | "closest";

export function getMatchTier(scorePercent: number): MatchTier {
  if (scorePercent >= 80) return "strong";
  if (scorePercent >= 65) return "good";
  if (scorePercent >= 50) return "possible";
  return "closest";
}

/** A single human-readable "why this match" bullet. Kept as structured data
 * (marker + kind + optional params) rather than pre-rendered text so the UI
 * layer can localize it via next-intl. */
export type MatchReasonKind =
  | "field_positive"
  | "field_caution"
  | "degree_match"
  | "english_met"
  | "english_gap"
  | "location_within"
  | "location_outside"
  | "budget_within"
  | "budget_slightly_over"
  | "budget_well_over"
  | "generic_positive"
  | "generic_caution";

export interface MatchReason {
  marker: "positive" | "caution";
  kind: MatchReasonKind;
  /** Set for budget_* and generic_* kinds, to look up the priority's label. */
  priorityType?: PriorityType;
  /** Set for english_gap. */
  params?: { required?: number; yours?: number };
}

export interface MatchResult {
  candidate: DemoUniversityProgram;
  scorePercent: number;
  tier: MatchTier;
  reasons: MatchReason[];
}

export interface MatchComputation {
  /** Every candidate that passed the (few) hard constraints, sorted by score desc. */
  results: MatchResult[];
  /** The subset actually rendered: every "possible" match or better, padded
   * out with the next-highest "closest" matches so at least MIN_DISPLAY_COUNT
   * are shown whenever that many candidates exist at all. */
  displayResults: MatchResult[];
  excludedCount: number;
  totalCount: number;
  /** True when there simply aren't enough comparable programs in the catalog
   * (fewer than the display minimum survived hard constraints) -- a data
   * limitation, not a sign the match engine found everything to be a bad fit. */
  hasLimitedData: boolean;
  /** Only the conditions that actually exclude candidates. Destination
   * country is intentionally not here -- it's a scored preference now, not
   * a filter. */
  hardConstraints: {
    applicationType: ApplicationType | null;
  };
  /** Shown for context only; candidates outside these are still scored and
   * displayed, just with a lower location score. */
  preferredCountries: CountryCode[];
}

export interface MatchProfileInputs {
  fieldOfStudy: string | null;
  applicationType: ApplicationType | null;
  maxTuition: number | null;
  tuitionCurrency: string | null;
  maxLivingCost: number | null;
  livingCostCurrency: string | null;
  englishTestType: EnglishTestType | null;
  englishTestScore: number | null;
}
