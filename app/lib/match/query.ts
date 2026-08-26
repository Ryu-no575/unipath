import type { CampusEnvironment, ClassSizePreference, ClimatePreference } from "@/app/lib/supabase/database.types";
import { CAMPUS_ENVIRONMENTS, CLASS_SIZE_PREFERENCES, CLIMATE_PREFERENCES } from "./types";
import type { MatchQuizAnswers } from "./types";

/**
 * Quiz answers travel to the results page as short URL query params rather
 * than through a DB round-trip -- that keeps Explore -> Find My Match ->
 * Results working in the browser even before the optional match_preferences
 * migration has been applied (see app/lib/actions/match.ts).
 */
const PARAM_KEYS = {
  campusEnvironment: "env",
  classSizePreference: "size",
  climatePreference: "climate",
  workWhileStudyingImportance: "work",
  scholarshipNeed: "schol",
} as const;

export function encodeMatchQuizAnswers(answers: MatchQuizAnswers): string {
  const params = new URLSearchParams({
    [PARAM_KEYS.campusEnvironment]: answers.campusEnvironment,
    [PARAM_KEYS.classSizePreference]: answers.classSizePreference,
    [PARAM_KEYS.climatePreference]: answers.climatePreference,
    [PARAM_KEYS.workWhileStudyingImportance]: String(answers.workWhileStudyingImportance),
    [PARAM_KEYS.scholarshipNeed]: answers.scholarshipNeed ? "1" : "0",
  });
  return params.toString();
}

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = searchParams[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/** Returns null if the required params are missing or invalid -- callers
 * should treat that as "quiz not completed yet" and redirect back to it. */
export function decodeMatchQuizAnswers(
  searchParams: Record<string, string | string[] | undefined>,
): MatchQuizAnswers | null {
  const env = readParam(searchParams, PARAM_KEYS.campusEnvironment);
  const size = readParam(searchParams, PARAM_KEYS.classSizePreference);
  const climate = readParam(searchParams, PARAM_KEYS.climatePreference);
  const work = readParam(searchParams, PARAM_KEYS.workWhileStudyingImportance);
  const schol = readParam(searchParams, PARAM_KEYS.scholarshipNeed);

  if (!env || !size || !climate || !work || !schol) return null;
  if (!CAMPUS_ENVIRONMENTS.includes(env as CampusEnvironment)) return null;
  if (!CLASS_SIZE_PREFERENCES.includes(size as ClassSizePreference)) return null;
  if (!CLIMATE_PREFERENCES.includes(climate as ClimatePreference)) return null;

  const workNumber = Number(work);
  if (!Number.isInteger(workNumber) || workNumber < 1 || workNumber > 5) return null;
  if (schol !== "0" && schol !== "1") return null;

  return {
    campusEnvironment: env as CampusEnvironment,
    classSizePreference: size as ClassSizePreference,
    climatePreference: climate as ClimatePreference,
    workWhileStudyingImportance: workNumber,
    scholarshipNeed: schol === "1",
  };
}
