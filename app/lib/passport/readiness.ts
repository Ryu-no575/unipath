import type {
  Database,
  DocumentStatus,
  DocumentType,
  SecondaryQualificationType,
  TestType,
} from "@/app/lib/supabase/database.types";

export const DOCUMENT_TYPES: DocumentType[] = [
  "cv",
  "transcript",
  "portfolio",
  "motivation_letter",
  "personal_statement",
  "recommendation",
  "english_certificate",
  "degree_certificate",
  "other",
];

export const TEST_TYPES: TestType[] = [
  "ielts",
  "toefl",
  "cambridge",
  "duolingo",
  "sat",
  "act",
  "gre",
  "gmat",
  "ap",
  "cils",
  "celi",
  "plida",
  "cert_it",
  "university_specific",
  "other",
];

/** Document types whose *content* is usually specific to one university
 * (a motivation letter written for Politecnico di Milano doesn't work for
 * TU Delft) -- these only count toward an application's readiness once
 * explicitly linked to it via application_document_links. Every other
 * document type is reusable across every application by document_type
 * alone (see task brief item 14). */
export const APPLICATION_SPECIFIC_DOCUMENT_TYPES: DocumentType[] = [
  "motivation_letter",
  "personal_statement",
  "portfolio",
];

const READY_DOCUMENT_STATUSES: DocumentStatus[] = ["ready", "submitted"];

/** "duolingo" is a real English proficiency test (Duolingo English Test) --
 * included here now that test_scores.test_type can express it (Personalized
 * Planning Phase 1 migration). Italian certs (cils/celi/plida/cert_it) are
 * deliberately excluded -- those are a separate language, not an English
 * signal. */
const ENGLISH_TEST_TYPES: TestType[] = ["ielts", "toefl", "cambridge", "duolingo"];

type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];
type ApplicationDocumentRow = Database["public"]["Tables"]["application_documents"]["Row"];
type TestScoreRow = Database["public"]["Tables"]["test_scores"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// ---------------------------------------------------------------------------
// Requirement classification
//
// admission_requirements.requirement_type/title/description is free text
// written by a curator or import script (see scripts/register-poc-source.mjs)
// -- there is no fixed vocabulary UniPath controls. We only ever match a
// requirement against the user's own data when the wording confidently
// identifies a document or test we track; everything else is surfaced
// unmodified with its source link rather than guessed at, per the "AI
// organizes, sources decide" principle.
// ---------------------------------------------------------------------------

/** "academic" (Personalized Planning Phase 1 -- app/lib/eligibility) covers
 * GPA-minimum and secondary/tertiary-qualification-type requirements.
 * computeApplicationReadiness below deliberately does not handle this
 * category (falls through to "unknown", same as "unclassified" was before)
 * -- only the Eligibility Engine (app/lib/eligibility/programEligibility.ts)
 * compares it, since it needs the user's GPA/qualification credentials that
 * ApplicationReadiness's document/test-only inputs don't carry. */
export type RequirementCategory = "document" | "test" | "academic" | "unclassified";

/** Secondary/tertiary-qualification acceptance patterns -- e.g. a
 * requirement mentioning "Bachelor's degree" only accepts
 * `bachelor_degree`; one mentioning "high school diploma" / "secondary
 * diploma" accepts any recognized secondary qualification. Exported so the
 * Eligibility Engine and this module never diverge on what a requirement's
 * wording actually accepts. */
export const QUALIFICATION_ACCEPTANCE_PATTERNS: { pattern: RegExp; accepts: SecondaryQualificationType[] }[] = [
  { pattern: /\bmaster'?s?\b/i, accepts: ["master_degree"] },
  { pattern: /\bbachelor'?s?\b/i, accepts: ["bachelor_degree"] },
  { pattern: /\bib diploma\b|\binternational baccalaureate\b/i, accepts: ["ib_diploma"] },
  { pattern: /\ba[- ]levels?\b/i, accepts: ["a_levels"] },
  { pattern: /\babitur\b/i, accepts: ["abitur"] },
  { pattern: /\bbaccalaur[ée]at\b/i, accepts: ["french_baccalaureat"] },
  {
    pattern: /\bhigh school diploma\b|\bsecondary (school )?diploma\b|\bsecondary (school )?(certificate|qualification)\b/i,
    accepts: [
      "national_secondary_diploma",
      "ib_diploma",
      "a_levels",
      "abitur",
      "french_baccalaureat",
      "other_national_secondary",
    ],
  },
];

const GPA_REQUIREMENT_PATTERN = /\bgpa\b|\bgrade point average\b|\bminimum (grade|average)\b|\bacademic average\b/i;

export interface ClassifiedRequirement {
  category: RequirementCategory;
  documentType?: DocumentType;
  /** Only set when category is "test": which of the tracked test types (or
   * "english" for any accepted English test) this requirement is asking for. */
  testHint?: TestType | "english";
  /** Only set when category is "academic". */
  academicHint?: "gpa" | "qualification_type";
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyRequirement(req: {
  requirementType: string;
  title: string;
  description?: string | null;
}): ClassifiedRequirement {
  const text = `${req.requirementType} ${req.title} ${req.description ?? ""}`.toLowerCase();

  if (matchesAny(text, [/portfolio/])) {
    return { category: "document", documentType: "portfolio" };
  }
  if (matchesAny(text, [/transcript/, /academic record/, /mark sheet/, /grade report/])) {
    return { category: "document", documentType: "transcript" };
  }
  if (matchesAny(text, [/motivation letter/, /letter of motivation/, /statement of purpose/])) {
    return { category: "document", documentType: "motivation_letter" };
  }
  if (matchesAny(text, [/personal statement/])) {
    return { category: "document", documentType: "personal_statement" };
  }
  if (matchesAny(text, [/recommendation/, /reference letter/])) {
    return { category: "document", documentType: "recommendation" };
  }
  if (matchesAny(text, [/\bcv\b/, /resume/, /curriculum vitae/])) {
    return { category: "document", documentType: "cv" };
  }
  if (matchesAny(text, [/degree certificate/, /diploma/, /degree award/])) {
    return { category: "document", documentType: "degree_certificate" };
  }
  if (matchesAny(text, [/ielts/])) {
    return { category: "test", testHint: "ielts" };
  }
  if (matchesAny(text, [/toefl/])) {
    return { category: "test", testHint: "toefl" };
  }
  if (matchesAny(text, [/cambridge/])) {
    return { category: "test", testHint: "cambridge" };
  }
  if (matchesAny(text, [/english (test|certificate|proficiency|language)/, /language certificate/])) {
    return { category: "test", testHint: "english" };
  }
  if (matchesAny(text, [/\bsat\b/])) {
    return { category: "test", testHint: "sat" };
  }
  if (matchesAny(text, [/\bact\b/])) {
    return { category: "test", testHint: "act" };
  }
  if (matchesAny(text, [/\bgre\b/])) {
    return { category: "test", testHint: "gre" };
  }
  if (matchesAny(text, [/\bgmat\b/])) {
    return { category: "test", testHint: "gmat" };
  }
  if (matchesAny(text, [/\bduolingo\b/])) {
    return { category: "test", testHint: "duolingo" };
  }
  if (matchesAny(text, [/\bap\b|\badvanced placement\b/])) {
    return { category: "test", testHint: "ap" };
  }
  if (matchesAny(text, [/\bcils\b/])) {
    return { category: "test", testHint: "cils" };
  }
  if (matchesAny(text, [/\bceli\b/])) {
    return { category: "test", testHint: "celi" };
  }
  if (matchesAny(text, [/\bplida\b/])) {
    return { category: "test", testHint: "plida" };
  }
  if (matchesAny(text, [/\bcert\.?\s?it\b/])) {
    return { category: "test", testHint: "cert_it" };
  }
  if (GPA_REQUIREMENT_PATTERN.test(text)) {
    return { category: "academic", academicHint: "gpa" };
  }
  if (QUALIFICATION_ACCEPTANCE_PATTERNS.some(({ pattern }) => pattern.test(text))) {
    return { category: "academic", academicHint: "qualification_type" };
  }

  return { category: "unclassified" };
}

// ---------------------------------------------------------------------------
// Per-application readiness
// ---------------------------------------------------------------------------

export type ReadinessItemStatus = "ready" | "missing" | "unknown";

export interface ReadinessItem {
  requirementId: string;
  title: string;
  description: string | null;
  status: ReadinessItemStatus;
  category: RequirementCategory;
  documentType?: DocumentType;
  testHint?: TestType | "english";
  sourceId: string | null;
}

export interface ApplicationReadiness {
  /** "limited" when there is no usable official requirement data at all
   * (no requirements row, or none of them could be classified) -- the UI
   * must show "Limited requirement data", never a fabricated percentage. */
  status: "limited" | "computed";
  scorePercent: number | null;
  readyCount: number;
  trackableCount: number;
  items: ReadinessItem[];
}

function isDocumentReady(doc: ApplicationDocumentRow): boolean {
  return READY_DOCUMENT_STATUSES.includes(doc.status);
}

function isTestUnexpired(test: TestScoreRow, today: string): boolean {
  return !test.expires_at || test.expires_at >= today;
}

export function hasEnglishSignal(
  documents: ApplicationDocumentRow[],
  testScores: TestScoreRow[],
  profile: Pick<ProfileRow, "english_test_type" | "english_test_score"> | null,
  today: string,
): boolean {
  if (documents.some((d) => d.document_type === "english_certificate" && isDocumentReady(d))) return true;
  if (
    testScores.some(
      (t) => ENGLISH_TEST_TYPES.includes(t.test_type) && isTestUnexpired(t, today),
    )
  ) {
    return true;
  }
  if (
    profile?.english_test_type &&
    profile.english_test_type !== "none" &&
    (profile.english_test_score ?? "").trim() !== ""
  ) {
    return true;
  }
  return false;
}

function hasTestTypeSignal(testScores: TestScoreRow[], testType: TestType, today: string): boolean {
  return testScores.some((t) => t.test_type === testType && isTestUnexpired(t, today));
}

function hasReusableDocumentSignal(documents: ApplicationDocumentRow[], documentType: DocumentType): boolean {
  return documents.some((d) => d.document_type === documentType && isDocumentReady(d));
}

function hasApplicationSpecificDocumentSignal(
  documents: ApplicationDocumentRow[],
  linkedDocumentIds: Set<string>,
  documentType: DocumentType,
): boolean {
  return documents.some(
    (d) => d.document_type === documentType && isDocumentReady(d) && linkedDocumentIds.has(d.id),
  );
}

export interface ComputeReadinessParams {
  requirements: AdmissionRequirementRow[];
  documents: ApplicationDocumentRow[];
  testScores: TestScoreRow[];
  linkedDocumentIds: Set<string>;
  profile: Pick<ProfileRow, "english_test_type" | "english_test_score"> | null;
  /** ISO date (yyyy-mm-dd), injected for testability. */
  today?: string;
}

export function computeApplicationReadiness(params: ComputeReadinessParams): ApplicationReadiness {
  const today = params.today ?? new Date().toISOString().slice(0, 10);
  const required = params.requirements.filter((r) => r.required);

  const items: ReadinessItem[] = required.map((req) => {
    const classified = classifyRequirement({
      requirementType: req.requirement_type,
      title: req.title,
      description: req.description,
    });

    let status: ReadinessItemStatus = "unknown";
    if (classified.category === "document" && classified.documentType) {
      const ready = APPLICATION_SPECIFIC_DOCUMENT_TYPES.includes(classified.documentType)
        ? hasApplicationSpecificDocumentSignal(params.documents, params.linkedDocumentIds, classified.documentType)
        : hasReusableDocumentSignal(params.documents, classified.documentType);
      status = ready ? "ready" : "missing";
    } else if (classified.category === "test" && classified.testHint) {
      const ready =
        classified.testHint === "english"
          ? hasEnglishSignal(params.documents, params.testScores, params.profile, today)
          : hasTestTypeSignal(params.testScores, classified.testHint, today);
      status = ready ? "ready" : "missing";
    }

    return {
      requirementId: req.id,
      title: req.title,
      description: req.description,
      status,
      category: classified.category,
      documentType: classified.documentType,
      testHint: classified.testHint,
      sourceId: req.source_id,
    };
  });

  const trackable = items.filter((i) => i.status !== "unknown");
  const ready = trackable.filter((i) => i.status === "ready");

  if (trackable.length === 0) {
    return { status: "limited", scorePercent: null, readyCount: 0, trackableCount: 0, items };
  }

  return {
    status: "computed",
    scorePercent: Math.round((ready.length / trackable.length) * 100),
    readyCount: ready.length,
    trackableCount: trackable.length,
    items,
  };
}

// ---------------------------------------------------------------------------
// Profile completion (reused fields only -- see AGENTS.md task notes:
// Passport must never re-ask for what Onboarding already collected).
// ---------------------------------------------------------------------------

const PROFILE_COMPLETION_FIELDS: (keyof ProfileRow)[] = [
  "nationality",
  "residence_country",
  "application_type",
  "intake_year",
  "intake_season",
  "field_of_study",
  "education_level",
  "gpa_value",
  "english_test_type",
  "max_tuition",
];

export function computeProfileCompletionPercent(profile: ProfileRow | null): number {
  if (!profile) return 0;
  const filled = PROFILE_COMPLETION_FIELDS.filter((field) => {
    const value = profile[field];
    return value !== null && value !== undefined && value !== "";
  }).length;
  return Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);
}
