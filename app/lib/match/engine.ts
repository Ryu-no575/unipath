import { PRIORITY_TYPES } from "@/app/lib/profile-types";
import type { CountryCode } from "@/app/lib/countries";
import type { PriorityType } from "@/app/lib/supabase/database.types";
import { DEMO_CATALOG } from "./demo-catalog";
import { getMatchTier } from "./types";
import type {
  DemoUniversityProgram,
  MatchComputation,
  MatchProfileInputs,
  MatchQuizAnswers,
  MatchReason,
  MatchResult,
} from "./types";

/** Whenever data allows, show at least this many candidates rather than
 * dead-ending on "no matches" -- see AGENTS.md task notes on Match Results. */
const MIN_DISPLAY_COUNT = 5;

/** A factor is notable enough to call out in "Why this match?" only past
 * these bounds -- otherwise it's unremarkable and would just be noise. */
const NOTABLE_POSITIVE = 0.82;
const NOTABLE_CAUTION = 0.6;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Rough, static approximations used only to compare demo budget figures
 * across currencies for match scoring. NOT real-time exchange rates, never
 * shown to the user -- if a currency isn't listed it's treated as 1:1 with
 * USD rather than failing the comparison.
 */
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

/** Linear falloff: at budget = 1.0, 50% over budget = 0. */
function budgetFitScore(candidateAmount: number, maxAmount: number | null): number {
  if (maxAmount == null || maxAmount <= 0) return 0.7;
  if (candidateAmount <= maxAmount) return 1;
  const overRatio = candidateAmount / maxAmount - 1;
  return clamp01(1 - overRatio / 0.5);
}

function normalizeTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

function scoreFieldOfStudyFit(fieldOfStudy: string | null, candidate: DemoUniversityProgram): number {
  const trimmed = fieldOfStudy?.trim() ?? "";
  if (!trimmed) return 0.7;
  if (trimmed.toLowerCase() === candidate.field.trim().toLowerCase()) return 1;

  const profileTokens = normalizeTokens(trimmed);
  const candidateTokens = new Set([
    ...normalizeTokens(candidate.field),
    ...normalizeTokens(candidate.programName),
  ]);
  let overlap = 0;
  for (const token of profileTokens) if (candidateTokens.has(token)) overlap++;
  if (overlap === 0) return 0.3;
  return clamp01(0.55 + 0.15 * overlap);
}

function scoreTuition(
  candidate: DemoUniversityProgram,
  profile: MatchProfileInputs,
  quiz: MatchQuizAnswers,
): number {
  const candidateUsd = toApproxUsd(candidate.tuitionAmount, candidate.tuitionCurrency);
  const maxUsd =
    profile.maxTuition != null
      ? toApproxUsd(profile.maxTuition, profile.tuitionCurrency ?? candidate.tuitionCurrency)
      : null;
  let score = budgetFitScore(candidateUsd, maxUsd);

  if (quiz.scholarshipNeed) {
    score = clamp01(score + (candidate.scholarshipsAvailable ? 0.15 : -0.15));
  }
  return score;
}

function scoreCostOfLiving(candidate: DemoUniversityProgram, profile: MatchProfileInputs): number {
  const candidateUsd = toApproxUsd(candidate.livingCostAmount, candidate.livingCostCurrency);
  const maxUsd =
    profile.maxLivingCost != null
      ? toApproxUsd(profile.maxLivingCost, profile.livingCostCurrency ?? candidate.livingCostCurrency)
      : null;
  return budgetFitScore(candidateUsd, maxUsd);
}

function scoreEmployment(candidate: DemoUniversityProgram, quiz: MatchQuizAnswers): number {
  const base = candidate.employmentScore / 5;
  const workFit = 1 - Math.abs(quiz.workWhileStudyingImportance - candidate.workWhileStudyingScore) / 4;
  return clamp01(0.6 * base + 0.4 * workFit);
}

function scoreLocation(
  candidate: DemoUniversityProgram,
  destinationCountries: CountryCode[],
  quiz: MatchQuizAnswers,
): number {
  let score = 0.6;
  if (destinationCountries.length === 0 || destinationCountries.includes(candidate.countryCode)) {
    score += 0.2;
  } else {
    score -= 0.3;
  }
  if (quiz.campusEnvironment !== "no_preference") {
    score += quiz.campusEnvironment === candidate.environment ? 0.15 : -0.1;
  }
  if (quiz.climatePreference !== "no_preference") {
    score += quiz.climatePreference === candidate.climate ? 0.1 : -0.05;
  }
  return clamp01(score);
}

function scoreCampusLife(candidate: DemoUniversityProgram, quiz: MatchQuizAnswers): number {
  const base = candidate.campusLifeScore / 5;
  const sizeFit =
    quiz.classSizePreference === "no_preference"
      ? 0.7
      : quiz.classSizePreference === candidate.studentBodySize
        ? 1
        : 0.4;
  return clamp01(0.6 * base + 0.4 * sizeFit);
}

/** Partial credit for English score requirements, never a hard cutoff --
 * a candidate who's 0.5 bands short of IELTS today may well clear it before
 * they apply, so this only ever costs points, it never excludes. Only IELTS
 * is modeled (see DemoUniversityProgram.minIeltsScore); any other test type,
 * or a program with no stated requirement, falls back to a neutral score
 * rather than a wrong-scale guess. */
function scoreEnglishRequirement(
  candidate: DemoUniversityProgram,
  profile: MatchProfileInputs,
): { score: number; gap: { required: number; yours: number } | null } {
  if (candidate.minIeltsScore == null) return { score: 0.8, gap: null };
  if (profile.englishTestType !== "ielts" || profile.englishTestScore == null) {
    return { score: 0.75, gap: null };
  }
  const required = candidate.minIeltsScore;
  const yours = profile.englishTestScore;
  if (yours >= required) return { score: 1, gap: null };
  const diff = required - yours;
  return { score: clamp01(1 - diff / 1.5), gap: { required, yours } };
}

/** The only conditions that remove a candidate entirely. Everything else
 * (budget, English score, location, ranking, ...) is a scored preference --
 * see AGENTS.md task notes: excluding too aggressively is what caused
 * "no matches" to show up far too often. */
function passesHardConstraints(
  candidate: DemoUniversityProgram,
  applicationType: MatchProfileInputs["applicationType"],
): boolean {
  if (applicationType && candidate.degreeType !== applicationType) {
    return false;
  }
  return true;
}

function marker(score: number): "positive" | "caution" | null {
  if (score >= NOTABLE_POSITIVE) return "positive";
  if (score < NOTABLE_CAUTION) return "caution";
  return null;
}

const GENERIC_REASON_TYPES: PriorityType[] = [
  "academic_quality",
  "ranking",
  "employment",
  "safety",
  "international_community",
  "research",
  "campus_life",
];

function buildReasons(params: {
  fieldScore: number;
  englishResult: { score: number; gap: { required: number; yours: number } | null };
  isOutsideCountry: boolean | null;
  hasApplicationType: boolean;
  factorScores: Record<PriorityType, number>;
  maxTuition: number | null;
  maxLivingCost: number | null;
}): MatchReason[] {
  const reasons: MatchReason[] = [];

  const fieldMarker = marker(params.fieldScore);
  if (fieldMarker) {
    reasons.push({ marker: fieldMarker, kind: fieldMarker === "positive" ? "field_positive" : "field_caution" });
  }

  if (params.hasApplicationType) {
    reasons.push({ marker: "positive", kind: "degree_match" });
  }

  if (params.englishResult.gap) {
    reasons.push({ marker: "caution", kind: "english_gap", params: params.englishResult.gap });
  } else if (params.englishResult.score === 1) {
    reasons.push({ marker: "positive", kind: "english_met" });
  }

  if (params.isOutsideCountry !== null) {
    reasons.push({
      marker: params.isOutsideCountry ? "caution" : "positive",
      kind: params.isOutsideCountry ? "location_outside" : "location_within",
    });
  }

  const pushBudget = (type: "tuition" | "cost_of_living", maxSet: number | null, score: number) => {
    if (maxSet == null) return;
    if (score >= 0.95) reasons.push({ marker: "positive", kind: "budget_within", priorityType: type });
    else if (score >= 0.6) reasons.push({ marker: "caution", kind: "budget_slightly_over", priorityType: type });
    else reasons.push({ marker: "caution", kind: "budget_well_over", priorityType: type });
  };
  pushBudget("tuition", params.maxTuition, params.factorScores.tuition);
  pushBudget("cost_of_living", params.maxLivingCost, params.factorScores.cost_of_living);

  for (const type of GENERIC_REASON_TYPES) {
    const m = marker(params.factorScores[type]);
    if (m) reasons.push({ marker: m, kind: m === "positive" ? "generic_positive" : "generic_caution", priorityType: type });
  }

  reasons.sort((a, b) => (a.marker === b.marker ? 0 : a.marker === "positive" ? -1 : 1));
  return reasons;
}

/** Fills the display list out to MIN_DISPLAY_COUNT using the next-highest
 * scoring candidates when fewer than that many clear the "possible" bar --
 * this is what replaces the old "no matches" dead end. Never invents score;
 * it just widens which already-computed results get shown. */
function selectDisplayMatches(results: MatchResult[]): MatchResult[] {
  const qualifying = results.filter((r) => r.tier !== "closest");
  if (qualifying.length >= MIN_DISPLAY_COUNT) return qualifying;
  const fillers = results.filter((r) => r.tier === "closest").slice(0, MIN_DISPLAY_COUNT - qualifying.length);
  return [...qualifying, ...fillers];
}

/** Field of Study fit and the English requirement are each a fixed share of
 * the score (not user-adjustable via a priority slider); the remaining share
 * is split across the 10 weighted priorities in proportion to how the user
 * weighted them. */
const FIELD_OF_STUDY_WEIGHT = 0.25;
const ENGLISH_WEIGHT = 0.1;
const PRIORITIES_WEIGHT = 1 - FIELD_OF_STUDY_WEIGHT - ENGLISH_WEIGHT;

export function computeMatches(input: {
  profile: MatchProfileInputs;
  destinationCountries: CountryCode[];
  priorities: Record<PriorityType, number>;
  quiz: MatchQuizAnswers;
  catalog?: DemoUniversityProgram[];
}): MatchComputation {
  const { profile, destinationCountries, priorities, quiz } = input;
  const catalog = input.catalog ?? DEMO_CATALOG;

  const candidates = catalog.filter((c) => passesHardConstraints(c, profile.applicationType));

  const totalWeight = PRIORITY_TYPES.reduce((sum, p) => sum + (priorities[p] ?? 3), 0) || 1;

  const results: MatchResult[] = candidates
    .map((candidate) => {
      const fieldScore = scoreFieldOfStudyFit(profile.fieldOfStudy, candidate);
      const englishResult = scoreEnglishRequirement(candidate, profile);
      const isOutsideCountry =
        destinationCountries.length > 0 ? !destinationCountries.includes(candidate.countryCode) : null;

      const factorScores: Record<PriorityType, number> = {
        tuition: scoreTuition(candidate, profile, quiz),
        academic_quality: candidate.academicQualityScore / 5,
        ranking: candidate.rankingScore / 5,
        employment: scoreEmployment(candidate, quiz),
        location: scoreLocation(candidate, destinationCountries, quiz),
        safety: candidate.safetyScore / 5,
        international_community: candidate.internationalCommunityScore / 5,
        cost_of_living: scoreCostOfLiving(candidate, profile),
        research: candidate.researchScore / 5,
        campus_life: scoreCampusLife(candidate, quiz),
      };

      const weightedAverage = PRIORITY_TYPES.reduce(
        (sum, p) => sum + (priorities[p] ?? 3) * factorScores[p],
        0,
      ) / totalWeight;

      const finalScore =
        FIELD_OF_STUDY_WEIGHT * fieldScore +
        ENGLISH_WEIGHT * englishResult.score +
        PRIORITIES_WEIGHT * weightedAverage;

      const scorePercent = Math.round(clamp01(finalScore) * 100);

      const reasons = buildReasons({
        fieldScore,
        englishResult,
        isOutsideCountry,
        hasApplicationType: profile.applicationType != null,
        factorScores,
        maxTuition: profile.maxTuition,
        maxLivingCost: profile.maxLivingCost,
      });

      return {
        candidate,
        scorePercent,
        tier: getMatchTier(scorePercent),
        reasons,
      };
    })
    .sort((a, b) => b.scorePercent - a.scorePercent);

  return {
    results,
    displayResults: selectDisplayMatches(results),
    excludedCount: catalog.length - candidates.length,
    totalCount: catalog.length,
    hasLimitedData: candidates.length > 0 && candidates.length < MIN_DISPLAY_COUNT,
    hardConstraints: {
      applicationType: profile.applicationType,
    },
    preferredCountries: destinationCountries,
  };
}
