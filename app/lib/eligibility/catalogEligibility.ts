import type { Database, EnglishTestType } from "@/app/lib/supabase/database.types";
import { computeApplicationReadiness } from "@/app/lib/passport/readiness";
import { computeProgramEligibility } from "./programEligibility";
import type { ProgramEligibility, UserCredentials } from "./types";

type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];
type ApplicationDocumentRow = Database["public"]["Tables"]["application_documents"]["Row"];
type TestScoreRow = Database["public"]["Tables"]["test_scores"]["Row"];

export interface CatalogProgramCandidate {
  programId: string;
  universityId: string;
  universityName: string;
  programName: string;
  /** The program's nearest real admission cycle's requirements -- empty when
   * none exist yet (the program simply won't be classifiable past
   * "unknown"). Never fabricated. */
  requirements: AdmissionRequirementRow[];
}

export interface CatalogEligibilityInputs {
  documents: ApplicationDocumentRow[];
  testScores: TestScoreRow[];
  /** Every document link across all of the user's own applications -- see
   * app/lib/routes/context.ts's target-mode branch for the same convention:
   * an application-specific document (portfolio, motivation letter) only
   * counts here if it happens to already be linked to an existing
   * application, since a catalog candidate has none of its own yet. */
  linkedDocumentIds: Set<string>;
  englishProfile: { english_test_type: EnglishTestType | null; english_test_score: string | null } | null;
  credentials: UserCredentials;
  /** ISO date (yyyy-mm-dd), injectable for tests. */
  today?: string;
}

/** Computes ProgramEligibility for every candidate in the (real, verified)
 * catalog against one set of credentials. Pure/synchronous -- callers fetch
 * the candidate list and the user's documents/test scores/credentials
 * (app/lib/data/eligibility.ts) and pass them in. */
export function computeCatalogEligibility(
  candidates: CatalogProgramCandidate[],
  inputs: CatalogEligibilityInputs,
): Map<string, ProgramEligibility> {
  const result = new Map<string, ProgramEligibility>();
  for (const candidate of candidates) {
    const readiness = computeApplicationReadiness({
      requirements: candidate.requirements,
      documents: inputs.documents,
      testScores: inputs.testScores,
      linkedDocumentIds: inputs.linkedDocumentIds,
      profile: inputs.englishProfile,
      today: inputs.today,
    });
    result.set(
      candidate.programId,
      computeProgramEligibility({ requirements: candidate.requirements, readiness, credentials: inputs.credentials }),
    );
  }
  return result;
}
