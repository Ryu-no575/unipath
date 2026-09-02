import type { CountryCode } from "@/app/lib/countries";
import { getMatchTier } from "./types";
import type { MatchProfileInputs } from "./types";
import type {
  RealMatchComputation,
  RealMatchReason,
  RealMatchResult,
  RealProgramCandidate,
} from "./real-types";

/**
 * Scores real, Supabase-backed programs -- deliberately a separate, simpler
 * engine from app/lib/match/engine.ts (which scores the fictional demo
 * catalog against academic_quality/ranking/safety/etc "*Score" fields that
 * only exist for that hand-authored demo data). Real programs only carry
 * the handful of fields an official source can confirm, so this only scores
 * on those: field of study, degree type, country, and tuition when
 * published. Never fabricates a score for a dimension the catalog has no
 * real data for (see AGENTS.md task notes on Match Results: "don't invent
 * fictional data to raise the Match Score").
 */

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const APPROX_USD_RATE: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.66,
  SGD: 0.74,
  CHF: 1.13,
  KRW: 0.00073,
  CNY: 0.14,
};

function toApproxUsd(amount: number, currency: string): number {
  const rate = APPROX_USD_RATE[currency] ?? 1;
  return amount * rate;
}

function normalizeTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function scoreFieldOfStudyFit(fieldOfStudy: string | null, candidate: RealProgramCandidate): number {
  const trimmed = fieldOfStudy?.trim() ?? "";
  if (!trimmed) return 0.7;

  const candidateField = candidate.field?.trim().toLowerCase() ?? "";
  if (candidateField && candidateField === trimmed.toLowerCase()) return 1;

  const profileTokens = normalizeTokens(trimmed);
  const candidateTokens = new Set([
    ...normalizeTokens(candidate.field ?? ""),
    ...normalizeTokens(candidate.programName),
  ]);
  let overlap = 0;
  for (const token of profileTokens) if (candidateTokens.has(token)) overlap++;
  if (overlap === 0) return 0.35;
  return clamp01(0.55 + 0.15 * overlap);
}

function scoreLocation(candidate: RealProgramCandidate, destinationCountries: CountryCode[]): number {
  if (destinationCountries.length === 0) return 0.7;
  if (!candidate.countryCode) return 0.55;
  return destinationCountries.includes(candidate.countryCode) ? 0.9 : 0.45;
}

function scoreTuition(
  candidate: RealProgramCandidate,
  profile: MatchProfileInputs,
): { score: number; known: boolean } {
  if (candidate.tuitionAmount == null) return { score: 0.7, known: false };
  if (profile.maxTuition == null) return { score: 0.7, known: false };

  const candidateUsd = toApproxUsd(candidate.tuitionAmount, candidate.tuitionCurrency ?? "USD");
  const maxUsd = toApproxUsd(profile.maxTuition, profile.tuitionCurrency ?? candidate.tuitionCurrency ?? "USD");
  if (candidateUsd <= maxUsd) return { score: 1, known: true };
  const overRatio = candidateUsd / maxUsd - 1;
  return { score: clamp01(1 - overRatio / 0.5), known: true };
}

function passesHardConstraints(
  candidate: RealProgramCandidate,
  applicationType: MatchProfileInputs["applicationType"],
): boolean {
  if (applicationType && candidate.degreeType && candidate.degreeType !== applicationType) {
    return false;
  }
  return true;
}

function buildReasons(params: {
  fieldScore: number;
  hasApplicationType: boolean;
  isOutsideCountry: boolean | null;
  tuition: { score: number; known: boolean };
}): RealMatchReason[] {
  const reasons: RealMatchReason[] = [];

  if (params.fieldScore >= 0.82) reasons.push({ marker: "positive", kind: "field_positive" });
  else if (params.fieldScore < 0.6) reasons.push({ marker: "caution", kind: "field_caution" });

  if (params.hasApplicationType) reasons.push({ marker: "positive", kind: "degree_match" });

  if (params.isOutsideCountry !== null) {
    reasons.push({
      marker: params.isOutsideCountry ? "caution" : "positive",
      kind: params.isOutsideCountry ? "location_outside" : "location_within",
    });
  }

  if (params.tuition.known) {
    reasons.push({
      marker: params.tuition.score >= 0.95 ? "positive" : "caution",
      kind: params.tuition.score >= 0.95 ? "budget_within" : "budget_over",
    });
  } else {
    reasons.push({ marker: "caution", kind: "budget_unknown" });
  }

  reasons.sort((a, b) => (a.marker === b.marker ? 0 : a.marker === "positive" ? -1 : 1));
  return reasons;
}

const FIELD_WEIGHT = 0.5;
const LOCATION_WEIGHT = 0.25;
const TUITION_WEIGHT = 0.25;

/**
 * Scores a single candidate against a profile. Pulled out of
 * `computeRealMatches` so a "What would improve this match" simulator can
 * re-run the exact same scoring math against a hypothetical profile (e.g. a
 * higher budget) for one already-fetched candidate, without shipping the
 * whole catalog to the client or hand-writing a second scoring formula.
 */
export function scoreRealCandidate(
  candidate: RealProgramCandidate,
  profile: MatchProfileInputs,
  destinationCountries: CountryCode[],
): RealMatchResult {
  const fieldScore = scoreFieldOfStudyFit(profile.fieldOfStudy, candidate);
  const locationScore = scoreLocation(candidate, destinationCountries);
  const tuition = scoreTuition(candidate, profile);

  const finalScore = FIELD_WEIGHT * fieldScore + LOCATION_WEIGHT * locationScore + TUITION_WEIGHT * tuition.score;
  const scorePercent = Math.round(clamp01(finalScore) * 100);

  const isOutsideCountry =
    destinationCountries.length > 0 && candidate.countryCode
      ? !destinationCountries.includes(candidate.countryCode)
      : null;

  const reasons = buildReasons({
    fieldScore,
    hasApplicationType: profile.applicationType != null && candidate.degreeType === profile.applicationType,
    isOutsideCountry,
    tuition,
  });

  return {
    candidate,
    scorePercent,
    tier: getMatchTier(scorePercent),
    reasons,
  };
}

export function computeRealMatches(input: {
  profile: MatchProfileInputs;
  destinationCountries: CountryCode[];
  candidates: RealProgramCandidate[];
}): RealMatchComputation {
  const { profile, destinationCountries, candidates } = input;
  const eligible = candidates.filter((c) => passesHardConstraints(c, profile.applicationType));

  const results: RealMatchResult[] = eligible
    .map((candidate) => scoreRealCandidate(candidate, profile, destinationCountries))
    .sort((a, b) => b.scorePercent - a.scorePercent);

  return {
    results,
    totalVerifiedPrograms: candidates.length,
    excludedCount: candidates.length - eligible.length,
  };
}
