import { computeCatalogEligibility, type CatalogEligibilityInputs, type CatalogProgramCandidate } from "./catalogEligibility";

const MAX_LISTED_PROGRAMS = 50;

/** The only two credential changes Phase 1 simulates -- both have a real,
 * safe numeric comparison already (see programEligibility.ts). A CEFR-band
 * change (e.g. Italian B1 -> B2) is deliberately NOT simulated yet: reliably
 * detecting a CEFR-worded minimum in free-text admission_requirements
 * without misreading it as a numeric value (a naive digit-extraction regex
 * would misparse "B2" as "2") needs real requirement data to design and
 * verify against, which the catalog doesn't have yet -- see the Phase 1
 * report's "what still needs real data" note rather than guessing here. */
export type CredentialOverride =
  | { kind: "english_score"; value: number }
  | { kind: "gpa_value"; value: number };

export interface UnlockSimulationResult {
  newlyEligibleCount: number;
  newlyEligiblePrograms: { programId: string; universityName: string; programName: string }[];
  /** How many catalog programs had ANY real, comparable requirement data at
   * all (baseline trackableCount > 0) -- task item 5: "Only count programs
   * where verified requirement data supports the calculation." A caller
   * showing `newlyEligibleCount: 0` alongside `evaluablePrograms: 0` must
   * render "not enough verified data yet", never a bare "0 programs". */
  evaluablePrograms: number;
}

/** Recomputes catalog-wide eligibility with one credential hypothetically
 * changed, and reports which programs newly become ELIGIBLE_NOW that
 * weren't before (task item 5's "+N programs potentially unlocked"). Never
 * fabricates a count -- a program with no verified requirement data stays
 * "unknown" in both the before and after pass and can never appear as
 * "newly unlocked". */
export function simulateCredentialChange(
  candidates: CatalogProgramCandidate[],
  baseline: CatalogEligibilityInputs,
  override: CredentialOverride,
): UnlockSimulationResult {
  const before = computeCatalogEligibility(candidates, baseline);
  const after = computeCatalogEligibility(candidates, {
    ...baseline,
    credentials: {
      ...baseline.credentials,
      englishScore: override.kind === "english_score" ? override.value : baseline.credentials.englishScore,
      gpaValue: override.kind === "gpa_value" ? override.value : baseline.credentials.gpaValue,
    },
  });

  const newlyEligiblePrograms: UnlockSimulationResult["newlyEligiblePrograms"] = [];
  let evaluablePrograms = 0;

  for (const candidate of candidates) {
    const beforeResult = before.get(candidate.programId);
    const afterResult = after.get(candidate.programId);
    if (beforeResult && beforeResult.trackableCount > 0) evaluablePrograms++;

    if (
      beforeResult?.tier !== "eligible_now" &&
      afterResult?.tier === "eligible_now" &&
      newlyEligiblePrograms.length < MAX_LISTED_PROGRAMS
    ) {
      newlyEligiblePrograms.push({
        programId: candidate.programId,
        universityName: candidate.universityName,
        programName: candidate.programName,
      });
    }
  }

  return { newlyEligibleCount: newlyEligiblePrograms.length, newlyEligiblePrograms, evaluablePrograms };
}
