import type { SecondaryQualificationType } from "@/app/lib/supabase/database.types";

/** Per-program eligibility classification (Personalized Planning Phase 1,
 * task item 4). Deliberately distinct from both `MatchTier`
 * (app/lib/match/types.ts -- preference fit) and the Route engine's
 * `EligibilityTier` (app/lib/routes/eligibility.ts -- English-only, route
 * scope). Never an admission-probability estimate -- only how many of the
 * program's real, classifiable admission requirements the user currently
 * meets. */
export type ProgramEligibilityTier =
  | "eligible_now"
  | "almost_eligible"
  | "not_currently_eligible"
  | "unknown";

export interface EligibilityRequirementItem {
  requirementId: string;
  title: string;
  status: "met" | "missing" | "unknown";
}

export interface ProgramEligibility {
  tier: ProgramEligibilityTier;
  items: EligibilityRequirementItem[];
  metCount: number;
  missingCount: number;
  /** met + missing -- excludes "unknown" items, same convention as
   * ApplicationReadiness.trackableCount (app/lib/passport/readiness.ts). */
  trackableCount: number;
}

/** The user's real, self-reported credentials this engine compares against
 * published requirements. Every field is nullable -- null means "not entered
 * yet", never a guessed default. */
export interface UserCredentials {
  englishScore: number | null;
  gpaValue: number | null;
  gpaScale: number | null;
  qualificationType: SecondaryQualificationType | null;
}
