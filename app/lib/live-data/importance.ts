import type { ChangeImportance } from "@/app/lib/supabase/database.types";

/**
 * Rule-based change importance (v1 deliberately does not require an AI
 * judgment call here -- see AGENTS.md task notes on Change importance).
 * Matched against `change_events.field_name`, which is always one of the
 * column names on universities / programs / admission_cycles.
 */
const CRITICAL_FIELDS = new Set([
  "application_deadline",
  "application_open_date",
  "min_english_score",
  "english_test_type",
  "entrance_exam",
  "required_documents",
  "eligibility",
]);

const IMPORTANT_FIELDS = new Set([
  "tuition",
  "tuition_currency",
  "application_fee",
  "application_fee_currency",
  "scholarship",
  "scholarships_available",
  "portfolio_requirement",
  "language",
  // "page_content" is the whole-page-hash fallback checkSource() records
  // when no per-field extractor exists yet for a source's page_type (see
  // extractStructuredData() in checkSource.ts). Since there is no field-level
  // signal to grade in that case, treat "the official page changed at all"
  // as worth a review notification rather than silently minor -- a reviewer
  // still has to move it past pending_review before anything is applied.
  "page_content",
]);

/** Everything else (name spelling, city, marketing copy, page design) is
 * minor by default -- only fields known to matter to an applicant's
 * decision or eligibility are promoted above that. */
export function classifyChangeImportance(fieldName: string): ChangeImportance {
  if (CRITICAL_FIELDS.has(fieldName)) return "critical";
  if (IMPORTANT_FIELDS.has(fieldName)) return "important";
  return "minor";
}
