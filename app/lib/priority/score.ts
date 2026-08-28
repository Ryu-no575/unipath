/**
 * Demand Priority Engine -- weights/config + pure scoring functions (task:
 * University Data Strategy pivot, section 2 "PRIORITY SCORE"). Deliberately
 * computed, never stored: same reasoning as app/lib/data/dataStatus.ts --
 * every signal this needs already lives on `universities`/`programs`/
 * `admission_cycles`/`sources`/`applications`/`community_posts`/
 * `watch_subscriptions`, so a cached `data_priority_score` column would just
 * be a second place for the truth to drift out of sync as those rows change.
 *
 * Deliberately a single self-contained file with no relative imports of its
 * own (constants + functions together), matching the existing convention for
 * lib modules that both Next's app build and the standalone `node
 * scripts/*.ts` CLIs (see scripts/priority-report.ts) both load directly --
 * e.g. app/lib/live-data/sourceStatus.ts, app/lib/live-data/domain.ts. A
 * multi-file split (scoring vs. weights) would need a relative import between
 * them, which Next's tsc rejects with an explicit `.ts` extension
 * (TS5097) and plain `node` rejects without one -- there is no extension
 * spelling that satisfies both loaders for a two-hop import, so the weights/
 * config constants live in this same file instead.
 */

export type PriorityTier = "tier_1_core" | "tier_2_important" | "tier_3_long_tail";

// ---------------------------------------------------------------------------
// Weights / config -- the tunable architecture (task brief section 2). Every
// constant below is deliberately named and isolated so the weighting can be
// retuned without touching the scoring functions further down this file.
//
// The five pillars:
//   internalDemand         -- UniPath's own usage signals (search/save/match/
//                              apply/community/data-request) for this university.
//   internationalRelevance -- how demonstrably it serves international
//                              applicants (English-taught programs, degree
//                              breadth, admissions info on file).
//   programDemand          -- whether its verified programs sit in fields
//                              international applicants search for most.
//   destinationDemand      -- how in-demand its country is as a study
//                              destination overall.
//   dataVerifiability      -- whether it has a stable identifier, a reachable
//                              official source, and verified programs, i.e.
//                              whether deeper verification is even tractable.
// ---------------------------------------------------------------------------

export interface PriorityWeights {
  internalDemand: number;
  internationalRelevance: number;
  programDemand: number;
  destinationDemand: number;
  dataVerifiability: number;
}

function assertWeightsSumToOne(weights: PriorityWeights, label: string) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`${label} priority weights must sum to 1, got ${sum}`);
  }
}

/** Task brief section 2's example split -- used once internal usage data
 * (applications, community activity, saved/watch signals) is actually
 * plentiful enough to trust. */
export const MATURE_WEIGHTS: PriorityWeights = {
  internalDemand: 0.35,
  internationalRelevance: 0.25,
  programDemand: 0.2,
  destinationDemand: 0.1,
  dataVerifiability: 0.1,
};

/** Task brief section 2: "まだUniPathユーザー数が少なくinternal demand dataが十分でない
 * 間は、International relevance + Destination demand + Program availability を
 * より重視してください." Internal demand is not zeroed out -- a handful of
 * real signals (an application, a watch, a community post) should still move
 * the needle -- just weighted far below the three demand-side pillars. */
export const EARLY_STAGE_WEIGHTS: PriorityWeights = {
  internalDemand: 0.05,
  internationalRelevance: 0.35,
  programDemand: 0.25,
  destinationDemand: 0.2,
  dataVerifiability: 0.15,
};

assertWeightsSumToOne(MATURE_WEIGHTS, "MATURE_WEIGHTS");
assertWeightsSumToOne(EARLY_STAGE_WEIGHTS, "EARLY_STAGE_WEIGHTS");

/**
 * Total real internal-demand events (see computeInternalDemandRawScore
 * below) across the whole catalog at which point that signal is trusted
 * enough to switch from EARLY_STAGE_WEIGHTS to MATURE_WEIGHTS. Deliberately a
 * blunt, adjustable constant rather than a per-university threshold -- the
 * whole catalog graduates together, since a handful of active universities
 * says nothing about whether the *other* 350 have simply never been looked
 * at yet.
 */
export const INTERNAL_DEMAND_MATURITY_THRESHOLD = 300;

export function selectPriorityWeights(totalInternalDemandEvents: number): {
  weights: PriorityWeights;
  regime: "early_stage" | "mature";
} {
  return totalInternalDemandEvents >= INTERNAL_DEMAND_MATURITY_THRESHOLD
    ? { weights: MATURE_WEIGHTS, regime: "mature" }
    : { weights: EARLY_STAGE_WEIGHTS, regime: "early_stage" };
}

/**
 * Destination-demand tiers (task brief section 5's priority countries, plus
 * every other country_code actually present in `universities` today). Never
 * a per-country university quota -- just a relative "how in-demand is this
 * country as a study destination" score used as one input among five. A
 * country not listed falls back to DEFAULT_DESTINATION_DEMAND_SCORE, so
 * adding a university from a new country never crashes the engine.
 */
export const DESTINATION_DEMAND_SCORES: Record<string, number> = {
  // Tier A -- the largest, broadest-demand destinations.
  US: 100,
  GB: 100,
  CA: 100,
  CH: 100,
  SG: 100,
  // Tier B -- major destinations with strong international intake.
  AU: 85,
  DE: 85,
  NL: 85,
  FR: 85,
  JP: 85,
  KR: 85,
  HK: 85,
  NZ: 85,
  // Tier C -- strong regional/subject-specific demand (e.g. IT for design &
  // architecture, Nordics for tuition-friendly English-taught masters).
  IT: 70,
  ES: 70,
  IE: 70,
  SE: 70,
  DK: 70,
  FI: 70,
  NO: 70,
  BE: 70,
  AT: 70,
  // Tier D -- growing but smaller applicant volume today.
  PT: 55,
  PL: 55,
  HU: 55,
  CZ: 55,
  GR: 55,
};

export const DEFAULT_DESTINATION_DEMAND_SCORE = 35;

/**
 * Task brief section 6: "大学を単純にランキング上位だけで選ばないでください... 実際に海外進学
 * 候補として比較される大学を優先してください." A name matching HEI_QUALIFY_PATTERN (see
 * app/lib/importers/ror) is a real degree-granting institution, but a
 * two-year community/technical/tribal college or a royal professional college
 * is not realistically what an international Bachelor/Master/PhD applicant
 * is comparing against flagship universities for -- distinct from "is this an
 * HEI at all" (already handled by classifyInstitutionNamePattern). Softer
 * than the disqualify multiplier since these are still real institutions and
 * the pattern is coarse by construction (see LOW_INTERNATIONAL_ORIENTATION_SCORE_MULTIPLIER
 * below) -- it only keeps them from tying with genuinely internationally-
 * oriented universities on country + source-health alone.
 */
export const LOW_INTERNATIONAL_ORIENTATION_PATTERN =
  /\bcommunity college\b|\btechnical college\b|\btribal college\b|\bvocational\b|\bregional college\b|\bjunior college\b|\bcareer college\b|\broyal college\b|\bhealth partners\b|\badult education\b/i;

export function getDestinationDemandScore(countryCode: string | null): number {
  if (!countryCode) return DEFAULT_DESTINATION_DEMAND_SCORE;
  return DESTINATION_DEMAND_SCORES[countryCode] ?? DEFAULT_DESTINATION_DEMAND_SCORE;
}

/**
 * Program-demand fields (task brief section 1D). Matched case-insensitively
 * against `programs.field`/`programs.official_name` substrings, since real
 * field values are free text (e.g. "Architecture", "Computer Science") set
 * by curators rather than drawn from a fixed enum.
 */
export const HIGH_DEMAND_PROGRAM_FIELDS: string[] = [
  "architecture",
  "engineering",
  "computer science",
  "data science",
  "business",
  "management",
  "economics",
  "finance",
  "design",
  "social science",
  "political science",
  "international relations",
  "psychology",
];

/** Score-based tier cutoffs (task brief section 3). Tiers reflect *priority*
 * (where to invest verification effort next), not current data completeness
 * -- a Tier 1 university can absolutely still be missing its programs; that
 * gap is exactly what "Next Verification Action" surfaces. Adjustable, and
 * intentionally not sized to hit a fixed per-tier headcount (task brief:
 * "国ごとに固定大学数をhardcodeしないでください" applies here too -- let real
 * scores fall where they fall). */
export const TIER_1_CORE_MIN_SCORE = 55;
export const TIER_2_IMPORTANT_MIN_SCORE = 40;

// ---------------------------------------------------------------------------
// Scoring -- pure functions over the weights/config above.
// ---------------------------------------------------------------------------

export interface UniversityDemandSignals {
  /** Real `applications` rows resolved to this university via program_id ->
   * programs.university_id. Never counts `custom_university_id` rows -- those
   * are off-catalog entries the priority engine has nothing to act on. */
  applicationCount: number;
  /** Real `community_posts` rows for this university. */
  communityPostCount: number;
  /** Real, enabled `watch_subscriptions` rows for this university -- the
   * closest existing proxy for "data request" / "I want to be notified about
   * this university" until a dedicated event log exists (see section 8 note
   * in app/lib/data/adminPriorities.ts). */
  watchSubscriptionCount: number;
}

export interface UniversityProgramSignals {
  field: string | null;
  language: string | null;
  degreeType: string | null;
  verifiedAt: string | null;
  hasAdmissionCycle: boolean;
}

export interface UniversityDataQualitySignals {
  hasStableIdentifier: boolean;
  hasOfficialWebsite: boolean;
  hasHealthySource: boolean;
}

/** From classifyInstitutionNamePattern (app/lib/importers/ror) -- the same
 * "is this actually a degree-granting HEI, not a hospital/school/research
 * institute/professional association" heuristic already used to flag
 * catalog rows for review (see app/lib/data/adminUniversities.ts). Reused
 * here rather than reimplemented: task brief section 6 asks the engine to
 * prioritize universities international applicants would actually compare,
 * not just anything ROR's "education" type happened to include. */
export type InstitutionNamePattern = "qualifies" | "disqualifies" | "ambiguous";

export interface UniversityPriorityInput {
  id: string;
  name: string;
  countryCode: string | null;
  namePattern: InstitutionNamePattern;
  demand: UniversityDemandSignals;
  programs: UniversityProgramSignals[];
  dataQuality: UniversityDataQualitySignals;
}

/** Multiplier applied to the final weighted score for institutions whose
 * name pattern suggests they are not (or may not be) a degree-granting HEI a
 * student would apply to as a study-abroad destination -- e.g. a hospital, a
 * K-12 school, a professional association, or a research institute that
 * happened to import under ROR's broad "education" type. Never zeroed out
 * entirely (the heuristic is imperfect and errs toward exclusion, per its own
 * doc comment) and never removes the row -- it only keeps clearly-wrong
 * entries out of Tier 1/2 verification priority. */
const DISQUALIFIED_NAME_SCORE_MULTIPLIER = 0.3;
const AMBIGUOUS_NAME_SCORE_MULTIPLIER = 0.85;
/** See LOW_INTERNATIONAL_ORIENTATION_PATTERN in ./weights. */
const LOW_INTERNATIONAL_ORIENTATION_SCORE_MULTIPLIER = 0.65;

function nameConfidenceMultiplier(name: string, pattern: InstitutionNamePattern): number {
  if (pattern === "disqualifies") return DISQUALIFIED_NAME_SCORE_MULTIPLIER;
  let multiplier = pattern === "ambiguous" ? AMBIGUOUS_NAME_SCORE_MULTIPLIER : 1;
  if (LOW_INTERNATIONAL_ORIENTATION_PATTERN.test(name)) multiplier *= LOW_INTERNATIONAL_ORIENTATION_SCORE_MULTIPLIER;
  return multiplier;
}

export interface UniversityPriorityResult {
  id: string;
  name: string;
  countryCode: string | null;
  score: number;
  tier: PriorityTier;
  breakdown: {
    internalDemand: number;
    internationalRelevance: number;
    programDemand: number;
    destinationDemand: number;
    dataVerifiability: number;
  };
  reasons: string[];
  missingData: string[];
  nextAction: string;
}

/** Raw (unnormalized) internal-demand weight per event type -- applications
 * are the strongest intent signal, community activity and watch/data-request
 * signals count for less. Used both to score a single university and (summed
 * across the catalog) to decide whether MATURE_WEIGHTS should kick in yet
 * (see selectPriorityWeights in ./weights). */
const APPLICATION_EVENT_WEIGHT = 3;
const COMMUNITY_POST_EVENT_WEIGHT = 2;
const WATCH_SUBSCRIPTION_EVENT_WEIGHT = 2;

export function computeInternalDemandRawScore(demand: UniversityDemandSignals): number {
  return (
    demand.applicationCount * APPLICATION_EVENT_WEIGHT +
    demand.communityPostCount * COMMUNITY_POST_EVENT_WEIGHT +
    demand.watchSubscriptionCount * WATCH_SUBSCRIPTION_EVENT_WEIGHT
  );
}

/** Log-scaled against the loudest university in today's catalog, so a
 * handful of early signals still produces a meaningful spread instead of
 * everything reading as either 0 or 100. `maxRawScore` is the highest
 * `computeInternalDemandRawScore` value across every university in the same
 * batch -- always recomputed together, never a hardcoded ceiling. */
export function normalizeInternalDemandScore(rawScore: number, maxRawScore: number): number {
  if (maxRawScore <= 0) return 0;
  return Math.round((100 * Math.log1p(rawScore)) / Math.log1p(maxRawScore));
}

function matchesHighDemandField(program: UniversityProgramSignals): boolean {
  const haystack = (program.field ?? "").toLowerCase();
  if (!haystack) return false;
  return HIGH_DEMAND_PROGRAM_FIELDS.some((field) => haystack.includes(field));
}

function isEnglishTaught(program: UniversityProgramSignals): boolean {
  return (program.language ?? "").toLowerCase().includes("english");
}

export function computeInternationalRelevanceScore(
  countryCode: string | null,
  programs: UniversityProgramSignals[],
): number {
  // A country-level baseline (task brief 1B/1C overlap acknowledged): with
  // zero verified programs, "unknown" should read as a modest baseline, not
  // a hard 0 -- but it caps well below what real per-university admissions
  // evidence can earn, so verifying a program always outscores assuming one.
  const countryBaseline = (getDestinationDemandScore(countryCode) / 100) * 30;

  if (programs.length === 0) return Math.round(countryBaseline);

  const hasEnglishProgram = programs.some(isEnglishTaught);
  const degreeLevels = new Set(programs.map((p) => p.degreeType).filter((d): d is string => Boolean(d)));
  const hasMultipleDegreeLevels = degreeLevels.size > 1;
  const hasAdmissionCycle = programs.some((p) => p.hasAdmissionCycle);

  let score = countryBaseline;
  if (hasEnglishProgram) score += 40;
  if (hasMultipleDegreeLevels) score += 20;
  if (hasAdmissionCycle) score += 20;

  return Math.round(Math.min(100, score));
}

export function computeProgramDemandScore(programs: UniversityProgramSignals[]): number {
  if (programs.length === 0) return 0;
  const matched = programs.filter(matchesHighDemandField).length;
  if (matched === 0) return 20; // some real program data, just not in a high-demand field yet.
  return Math.round(Math.min(100, 70 + (matched - 1) * 10));
}

export function computeDestinationDemandScore(countryCode: string | null): number {
  return getDestinationDemandScore(countryCode);
}

export function computeDataVerifiabilityScore(
  quality: UniversityDataQualitySignals,
  programs: UniversityProgramSignals[],
): number {
  let score = 0;
  if (quality.hasStableIdentifier) score += 25;
  if (quality.hasOfficialWebsite) score += 15;
  if (quality.hasHealthySource) score += 35;
  if (programs.length > 0) score += 15;
  if (programs.some((p) => p.verifiedAt)) score += 10;
  return Math.round(Math.min(100, score));
}

function scoreToTier(score: number): PriorityTier {
  if (score >= TIER_1_CORE_MIN_SCORE) return "tier_1_core";
  if (score >= TIER_2_IMPORTANT_MIN_SCORE) return "tier_2_important";
  return "tier_3_long_tail";
}

function buildReasons(input: UniversityPriorityInput, breakdown: UniversityPriorityResult["breakdown"]): string[] {
  const reasons: string[] = [];
  if (input.namePattern === "disqualifies") {
    reasons.push("Caution: name pattern suggests this may not be a degree-granting HEI");
  }
  if (breakdown.internalDemand > 0) {
    const parts: string[] = [];
    if (input.demand.applicationCount > 0) parts.push(`${input.demand.applicationCount} application(s)`);
    if (input.demand.watchSubscriptionCount > 0) parts.push(`${input.demand.watchSubscriptionCount} data request(s)`);
    if (input.demand.communityPostCount > 0) parts.push(`${input.demand.communityPostCount} community post(s)`);
    reasons.push(`Real UniPath demand: ${parts.join(", ")}`);
  }
  if (breakdown.destinationDemand >= 70) {
    reasons.push(`High-demand study destination (${input.countryCode ?? "unknown country"})`);
  }
  const highDemandPrograms = input.programs.filter(matchesHighDemandField);
  if (highDemandPrograms.length > 0) {
    const fields = Array.from(new Set(highDemandPrograms.map((p) => p.field))).join(", ");
    reasons.push(`Has program(s) in high-demand field(s): ${fields}`);
  }
  if (input.programs.some(isEnglishTaught)) {
    reasons.push("English-taught program on file");
  }
  if (breakdown.dataVerifiability >= 75) {
    reasons.push("Official source verified reachable");
  }
  if (reasons.length === 0) {
    reasons.push("Baseline priority from destination and country relevance only -- no program or usage data yet");
  }
  return reasons;
}

function buildMissingDataAndNextAction(
  input: UniversityPriorityInput,
): { missingData: string[]; nextAction: string } {
  const missing: string[] = [];
  if (!input.dataQuality.hasStableIdentifier) missing.push("No stable identifier (ROR ID)");
  if (!input.dataQuality.hasOfficialWebsite) missing.push("No official website on file");
  if (!input.dataQuality.hasHealthySource) missing.push("Official source not confirmed reachable");
  if (input.programs.length === 0) missing.push("No programs verified yet");
  else if (!input.programs.some((p) => p.verifiedAt)) missing.push("Programs on file are not yet verified");
  if (input.programs.length > 0 && !input.programs.some((p) => p.hasAdmissionCycle)) {
    missing.push("No admissions cycle (deadline/requirements) on file");
  }

  let nextAction: string;
  if (!input.dataQuality.hasOfficialWebsite || !input.dataQuality.hasHealthySource) {
    nextAction = "Verify the official website source is reachable";
  } else if (input.programs.length === 0) {
    nextAction = "Add and verify a top program (e.g. Computer Science, Business, Engineering) with an official source";
  } else if (!input.programs.some((p) => p.verifiedAt)) {
    nextAction = "Verify the existing program(s) against their official source";
  } else if (!input.programs.some((p) => p.hasAdmissionCycle)) {
    nextAction = "Add and verify an admissions cycle (deadline, requirements, tuition)";
  } else {
    nextAction = "Deepen coverage: add another high-demand program";
  }

  return { missingData: missing, nextAction };
}

export function computeUniversityPriority(
  input: UniversityPriorityInput,
  weights: PriorityWeights,
  internalDemandMaxRawScore: number,
): UniversityPriorityResult {
  const internalDemandRaw = computeInternalDemandRawScore(input.demand);
  const breakdown = {
    internalDemand: normalizeInternalDemandScore(internalDemandRaw, internalDemandMaxRawScore),
    internationalRelevance: computeInternationalRelevanceScore(input.countryCode, input.programs),
    programDemand: computeProgramDemandScore(input.programs),
    destinationDemand: computeDestinationDemandScore(input.countryCode),
    dataVerifiability: computeDataVerifiabilityScore(input.dataQuality, input.programs),
  };

  const rawScore =
    breakdown.internalDemand * weights.internalDemand +
    breakdown.internationalRelevance * weights.internationalRelevance +
    breakdown.programDemand * weights.programDemand +
    breakdown.destinationDemand * weights.destinationDemand +
    breakdown.dataVerifiability * weights.dataVerifiability;
  const score = Math.round(rawScore * nameConfidenceMultiplier(input.name, input.namePattern));

  const { missingData, nextAction } = buildMissingDataAndNextAction(input);
  if (input.namePattern === "disqualifies") {
    missingData.unshift("Name pattern suggests this may not be a degree-granting HEI (e.g. hospital, school, research institute) -- confirm before treating as a verification priority");
  } else if (input.namePattern === "ambiguous") {
    missingData.push("Institution type unclear from name alone -- confirm it is a degree-granting HEI");
  }
  if (LOW_INTERNATIONAL_ORIENTATION_PATTERN.test(input.name)) {
    missingData.push("Name pattern suggests limited international full-degree demand (e.g. community/technical/tribal college) -- confirm before deep verification");
  }

  return {
    id: input.id,
    name: input.name,
    countryCode: input.countryCode,
    score,
    tier: scoreToTier(score),
    breakdown,
    reasons: buildReasons(input, breakdown),
    missingData,
    nextAction,
  };
}
