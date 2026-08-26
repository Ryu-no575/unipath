import type { Database } from "@/app/lib/supabase/database.types";
import { classifyRequirement } from "@/app/lib/passport/readiness";

type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];

/** Pulls the first number out of a free-text minimum_value (e.g. "6.5",
 * "IELTS 6.5 overall", "3.0/4.0"). Returns null when no number is present --
 * callers must treat that as "can't compare", never as zero. */
export function parseNumericMinimum(minimumValue: string | null): number | null {
  if (!minimumValue) return null;
  const match = minimumValue.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export type EligibilityTier = "safety" | "match" | "reach" | "unknown";

export interface EligibilityAssessment {
  tier: EligibilityTier;
  /** The single tightest numeric requirement compared, for display -- null
   * when nothing comparable was found. */
  englishTarget: number | null;
  englishCurrent: number | null;
}

/** Compares a program's actual admission_requirements against the user's
 * actual English score to bucket it as safety/match/reach -- never an
 * admission-probability estimate (task brief item 13), just how far current
 * preparation is from the published minimum. "unknown" whenever either side
 * of the comparison is missing real data -- never guessed. */
export function assessEligibility(params: {
  requirements: AdmissionRequirementRow[];
  englishScore: number | null;
}): EligibilityAssessment {
  let englishTarget: number | null = null;

  for (const req of params.requirements) {
    if (!req.required) continue;
    const classified = classifyRequirement({
      requirementType: req.requirement_type,
      title: req.title,
      description: req.description,
    });
    if (classified.category !== "test" || !classified.testHint) continue;
    const parsed = parseNumericMinimum(req.minimum_value);
    if (parsed == null) continue;
    // Keep the highest published minimum when multiple English requirements
    // exist (e.g. an overall band plus a stricter per-skill one).
    if (englishTarget == null || parsed > englishTarget) englishTarget = parsed;
  }

  if (englishTarget == null || params.englishScore == null) {
    return { tier: "unknown", englishTarget, englishCurrent: params.englishScore };
  }

  const margin = params.englishScore - englishTarget;
  let tier: EligibilityTier;
  if (margin >= 0.5) tier = "safety";
  else if (margin >= 0) tier = "match";
  else tier = "reach";

  return { tier, englishTarget, englishCurrent: params.englishScore };
}
