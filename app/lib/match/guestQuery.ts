import type { ApplicationType } from "@/app/lib/supabase/database.types";
import type { CountryCode } from "@/app/lib/countries";
import { COUNTRY_CODES } from "@/app/lib/countries";
import { APPLICATION_TYPES, type ProfileFormValues } from "@/app/lib/profile-types";
import type { MatchProfileInputs } from "./types";

/**
 * A guest (unauthenticated) visitor has no `profiles` row for
 * getMatchProfileData (see app/lib/data/match.ts) to read, so the Guest
 * Match Quiz collects the same match-driving fields directly and hands them
 * to Results via short URL query params -- same "no DB round-trip" approach
 * as app/lib/match/query.ts uses for the account quiz's own questions.
 * Never carries anything beyond what the real match engine
 * (app/lib/match/real-engine.ts) actually reads, and nothing personally
 * identifying, since none of this is tied to an account.
 */
const PARAM_KEYS = {
  marker: "g",
  fieldOfStudy: "field",
  applicationType: "degree",
  maxTuition: "tuition",
  tuitionCurrency: "cur",
  destinationCountries: "countries",
} as const;

export interface GuestMatchAnswers {
  profileInputs: MatchProfileInputs;
  destinationCountries: CountryCode[];
}

/** Only the subset of ProfileFormValues the real match engine reads --
 * intake year/season, academic, and priorities are collected by the Guest
 * Match Quiz too (see GuestMatchQuizWizard) but only for prefilling
 * onboarding later, never for scoring itself. */
export function encodeGuestMatchQuery(values: ProfileFormValues): string {
  const params = new URLSearchParams({ [PARAM_KEYS.marker]: "1" });
  if (values.fieldOfStudy.trim()) params.set(PARAM_KEYS.fieldOfStudy, values.fieldOfStudy.trim());
  if (values.applicationType) params.set(PARAM_KEYS.applicationType, values.applicationType);
  if (values.maxTuition.trim()) params.set(PARAM_KEYS.maxTuition, values.maxTuition.trim());
  if (values.tuitionCurrency) params.set(PARAM_KEYS.tuitionCurrency, values.tuitionCurrency);
  if (values.destinationCountries.length > 0) {
    params.set(PARAM_KEYS.destinationCountries, values.destinationCountries.join(","));
  }
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

/** Returns null only when the guest never actually ran the quiz (no marker
 * param at all) -- callers should send them back to /explore/match. Every
 * individual field is optional (an empty quiz answer just means "match
 * against everything"), matching how the account-profile path already
 * treats an unset field (see profileToMatchInputs). */
export function decodeGuestMatchQuery(
  searchParams: Record<string, string | string[] | undefined>,
): GuestMatchAnswers | null {
  if (readParam(searchParams, PARAM_KEYS.marker) !== "1") return null;

  const applicationType = readParam(searchParams, PARAM_KEYS.applicationType);
  const validApplicationType =
    applicationType && (APPLICATION_TYPES as string[]).includes(applicationType)
      ? (applicationType as ApplicationType)
      : null;

  const maxTuitionRaw = readParam(searchParams, PARAM_KEYS.maxTuition);
  const maxTuitionParsed = maxTuitionRaw ? Number(maxTuitionRaw) : NaN;

  const countriesRaw = readParam(searchParams, PARAM_KEYS.destinationCountries);
  const destinationCountries = (countriesRaw ? countriesRaw.split(",") : []).filter(
    (code): code is CountryCode => (COUNTRY_CODES as readonly string[]).includes(code),
  );

  return {
    profileInputs: {
      fieldOfStudy: readParam(searchParams, PARAM_KEYS.fieldOfStudy),
      applicationType: validApplicationType,
      maxTuition: Number.isFinite(maxTuitionParsed) ? maxTuitionParsed : null,
      tuitionCurrency: readParam(searchParams, PARAM_KEYS.tuitionCurrency),
      maxLivingCost: null,
      livingCostCurrency: null,
      englishTestType: null,
      englishTestScore: null,
    },
    destinationCountries,
  };
}
