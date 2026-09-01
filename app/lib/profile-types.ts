import type {
  ApplicationType,
  Database,
  EnglishTestType,
  IntakeSeason,
  JourneyStage,
  PriorityType,
} from "./supabase/database.types";

/** The onboarding question "Where are you in your study abroad journey?"
 * (AGENTS.md section 1) -- order matters, it's rendered as this list. */
export const SELF_REPORTED_STAGES: JourneyStage[] = [
  "exploring",
  "choosing",
  "preparing_applications",
  "applied",
  "received_offer",
  "preparing_visa",
  "preparing_move",
  "arrived",
];

/** Maps each PriorityType to its key in the PriorityOptions message
 * namespace (the DB enum is snake_case; message keys are camelCase). Shared
 * by every UI that renders priority weights (onboarding/profile forms, the
 * Match Quiz summary, and match results factor breakdowns). */
export const PRIORITY_LABEL_KEYS = {
  tuition: "tuition",
  academic_quality: "academicQuality",
  ranking: "ranking",
  employment: "employment",
  location: "location",
  safety: "safety",
  international_community: "internationalCommunity",
  cost_of_living: "costOfLiving",
  research: "research",
  campus_life: "campusLife",
} as const satisfies Record<PriorityType, string>;

export const PRIORITY_TYPES: PriorityType[] = [
  "tuition",
  "academic_quality",
  "ranking",
  "employment",
  "location",
  "safety",
  "international_community",
  "cost_of_living",
  "research",
  "campus_life",
];

export const APPLICATION_TYPES: ApplicationType[] = [
  "bachelor",
  "master",
  "phd",
  "exchange",
  "transfer",
];

export const INTAKE_SEASONS: IntakeSeason[] = [
  "spring",
  "summer",
  "fall",
  "winter",
  "flexible",
];

export const ENGLISH_TEST_TYPES: EnglishTestType[] = [
  "ielts",
  "toefl",
  "duolingo",
  "cambridge",
  "none",
  "other",
];

/** Client-side form state — everything is a string/array so it maps 1:1 onto
 * <input>/<select> values; converted to typed DB values in the Server Action. */
export interface ProfileFormValues {
  selfReportedStage: JourneyStage | "";
  nationality: string;
  residenceCountry: string;
  preferredLocale: string;
  timezone: string;
  applicationType: ApplicationType | "";
  intakeYear: string;
  intakeSeason: IntakeSeason | "";
  fieldOfStudy: string;
  destinationCountries: string[];
  educationLevel: string;
  previousInstitution: string;
  gpaValue: string;
  gpaScale: string;
  englishTestType: EnglishTestType | "";
  englishTestScore: string;
  maxTuition: string;
  tuitionCurrency: string;
  maxLivingCost: string;
  livingCostCurrency: string;
  priorities: Record<PriorityType, number>;
}

export function emptyProfileFormValues(): ProfileFormValues {
  return {
    selfReportedStage: "",
    nationality: "",
    residenceCountry: "",
    preferredLocale: "",
    timezone: "",
    applicationType: "",
    intakeYear: "",
    intakeSeason: "",
    fieldOfStudy: "",
    destinationCountries: [],
    educationLevel: "",
    previousInstitution: "",
    gpaValue: "",
    gpaScale: "",
    englishTestType: "",
    englishTestScore: "",
    maxTuition: "",
    tuitionCurrency: "",
    maxLivingCost: "",
    livingCostCurrency: "",
    priorities: Object.fromEntries(PRIORITY_TYPES.map((p) => [p, 3])) as Record<
      PriorityType,
      number
    >,
  };
}

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DestinationRow = Database["public"]["Tables"]["profile_destination_preferences"]["Row"];
type PriorityRow = Database["public"]["Tables"]["profile_priorities"]["Row"];

export function profileToFormValues(
  profile: ProfileRow | null,
  destinations: DestinationRow[],
  priorities: PriorityRow[],
): ProfileFormValues {
  const base = emptyProfileFormValues();
  if (!profile) {
    return {
      ...base,
      destinationCountries: destinations.map((d) => d.country_code),
      priorities: {
        ...base.priorities,
        ...Object.fromEntries(priorities.map((p) => [p.priority_type, p.weight])),
      },
    };
  }

  return {
    selfReportedStage: profile.self_reported_stage ?? "",
    nationality: profile.nationality ?? "",
    residenceCountry: profile.residence_country ?? "",
    preferredLocale: profile.preferred_locale ?? "",
    timezone: profile.timezone ?? "",
    applicationType: profile.application_type ?? "",
    intakeYear: profile.intake_year ? String(profile.intake_year) : "",
    intakeSeason: profile.intake_season ?? "",
    fieldOfStudy: profile.field_of_study ?? "",
    destinationCountries: destinations.map((d) => d.country_code),
    educationLevel: profile.education_level ?? "",
    previousInstitution: profile.previous_institution ?? "",
    gpaValue: profile.gpa_value != null ? String(profile.gpa_value) : "",
    gpaScale: profile.gpa_scale != null ? String(profile.gpa_scale) : "",
    englishTestType: profile.english_test_type ?? "",
    englishTestScore: profile.english_test_score ?? "",
    maxTuition: profile.max_tuition != null ? String(profile.max_tuition) : "",
    tuitionCurrency: profile.tuition_currency ?? "",
    maxLivingCost: profile.max_living_cost != null ? String(profile.max_living_cost) : "",
    livingCostCurrency: profile.living_cost_currency ?? "",
    priorities: {
      ...base.priorities,
      ...Object.fromEntries(priorities.map((p) => [p.priority_type, p.weight])),
    },
  };
}
