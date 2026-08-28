/**
 * Data Status classification (task brief item 7: demo / imported / verified
 * / needs_review) for universities and programs.
 *
 * Deliberately NOT a stored column: this codebase already carries every
 * signal a status needs (universities.data_source + whether any of its
 * sources are confirmed reachable; programs.verified_at + programs.official_url
 * + programs.needs_review), and storing a second, independently-updated
 * status value alongside those would just be a second place for the truth to
 * drift out of sync with the underlying signals (see e.g.
 * app/lib/match/real-types.ts's `candidate.verified`, which is computed the
 * same way, not stored). "demo" never appears here in practice -- the
 * fictional match catalog (app/lib/match/demo-catalog.ts) never touches
 * Supabase at all, so no real university/program row can ever legitimately
 * carry it; it exists in the type only so a caller that somehow has a demo
 * row (a future seed tool, a test fixture) has a name for it instead of
 * misreporting it as "imported".
 */
export type DataStatus = "demo" | "imported" | "verified" | "needs_review";

export interface UniversityStatusInputs {
  dataSource: string | null;
  /** True when at least one non-ROR source attached to this university (or
   * to one of its programs/admission cycles) has url_status === "valid" and
   * is not admin_rejected. */
  hasVerifiedSource: boolean;
  /** True when at least one non-ROR source exists for this university at
   * all, even if none currently validate. */
  hasAnySource: boolean;
}

export function computeUniversityDataStatus(input: UniversityStatusInputs): DataStatus {
  if (input.hasVerifiedSource) return "verified";
  if (input.hasAnySource) return "needs_review";
  if (input.dataSource === "ror") return "imported";
  return "needs_review";
}

export interface ProgramStatusInputs {
  verifiedAt: string | null;
  needsReview: boolean;
  officialUrl: string | null;
}

export function computeProgramDataStatus(input: ProgramStatusInputs): DataStatus {
  if (input.needsReview) return "needs_review";
  if (input.verifiedAt) return "verified";
  if (input.officialUrl) return "imported";
  return "needs_review";
}

export const DATA_STATUS_VALUES: DataStatus[] = ["demo", "imported", "verified", "needs_review"];

/**
 * Verification Confidence (task: Admin側でHigh/Medium/Lowを表示し、Lowを自動Verify
 * しないでください). Purely computed from signals already on the row -- same
 * "no second place for the truth to drift" reasoning as DataStatus above.
 * `verified` universities are always `high` by construction (a verified
 * source already required a stable identifier check upstream in
 * app/lib/importers/ror/index.ts and a real HTTP 200-299 + same-domain
 * landing in validateSource.ts / scripts/verify-universities.ts) -- this
 * mostly matters for classifying *unverified* rows so an admin knows which
 * ones are close to done vs. genuinely uncertain.
 */
export type VerificationConfidence = "high" | "medium" | "low";

export interface UniversityConfidenceInputs {
  hasStableIdentifier: boolean;
  hasVerifiedSource: boolean;
  namePattern: "qualifies" | "disqualifies" | "ambiguous";
  isDuplicateCandidate: boolean;
}

export function computeUniversityConfidence(input: UniversityConfidenceInputs): VerificationConfidence {
  if (input.namePattern === "disqualifies") return "low";
  if (input.hasVerifiedSource && input.hasStableIdentifier && !input.isDuplicateCandidate && input.namePattern === "qualifies") {
    return "high";
  }
  if (input.hasVerifiedSource || input.hasStableIdentifier) return "medium";
  return "low";
}

/** Human-readable reason a source's automated check didn't confirm it --
 * shown next to "Needs Review" so an admin knows what to look at instead of
 * a bare status label (task: "Needs Reviewには必ず理由を出してください"). */
export function describeUrlStatus(status: string): string {
  switch (status) {
    case "not_found":
      return "official page returned 404 / not found";
    case "gone":
      return "official page returned 410 / permanently removed";
    case "invalid_domain":
      return "resolved to a different domain than the university's official website";
    case "blocked":
      return "blocked by the site (403/429) or its robots.txt";
    case "timeout":
      return "request to the official website timed out";
    case "unknown":
      return "could not confirm the official page loaded correctly";
    default:
      return status;
  }
}

export interface UniversityReviewReasonInputs {
  dataStatus: DataStatus;
  hasStableIdentifier: boolean;
  hasOfficialWebsite: boolean;
  hasAnySource: boolean;
  hasUncheckedSource: boolean;
  /** url_status of the worst hard-broken non-ROR source, if any. */
  hardBrokenStatus: string | null;
  namePattern: "qualifies" | "disqualifies" | "ambiguous";
  isDuplicateCandidate: boolean;
  duplicateOfName: string | null;
}

/**
 * Ranked, specific reasons a university is sitting in Needs Review (task:
 * "悪い例: Needs Review / 良い例: Needs Review Reason: ..."). Returns an empty
 * array for `verified` rows -- nothing to review. Never returns a bare
 * "Needs Review" with no explanation.
 */
export function computeUniversityReviewReasons(input: UniversityReviewReasonInputs): string[] {
  if (input.dataStatus === "verified") return [];

  const reasons: string[] = [];

  if (input.namePattern === "disqualifies") {
    reasons.push("Institution type unclear -- name suggests a hospital, research institute, or similar non-university organization");
  } else if (input.namePattern === "ambiguous") {
    reasons.push("Institution type unclear from name alone");
  }

  if (!input.hasOfficialWebsite && !input.hasAnySource) {
    reasons.push("No official website on file");
  }

  if (!input.hasStableIdentifier) {
    reasons.push("No ROR ID or equivalent stable identifier");
  }

  if (input.hardBrokenStatus) {
    reasons.push(`Official website could not be verified (${describeUrlStatus(input.hardBrokenStatus)})`);
  }

  if (input.isDuplicateCandidate) {
    reasons.push(input.duplicateOfName ? `Possible duplicate of "${input.duplicateOfName}"` : "Possible duplicate of another catalog entry");
  }

  if (reasons.length === 0 && input.hasUncheckedSource) {
    reasons.push("Official website has not been checked yet");
  }

  if (reasons.length === 0) {
    reasons.push("Automated verification was inconclusive");
  }

  return reasons;
}
