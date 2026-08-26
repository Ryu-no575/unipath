/** Human-readable label for a change_events.field_name value (a
 * universities/programs/admission_cycles column name). Falls back to the
 * raw field name -- still readable, since these are snake_case column
 * names -- for anything not called out explicitly. Shared by the
 * notification fan-out and by the Latest Updates / notification detail UI
 * so both describe a given field the same way. */
export const FIELD_LABELS: Record<string, string> = {
  application_deadline: "Application deadline",
  application_open_date: "Application open date",
  min_english_score: "English requirement",
  english_test_type: "English test type",
  entrance_exam: "Entrance exam",
  required_documents: "Required documents",
  eligibility: "Eligibility",
  tuition: "Tuition",
  tuition_currency: "Tuition currency",
  application_fee: "Application fee",
  scholarship: "Scholarship",
  scholarships_available: "Scholarship availability",
  portfolio_requirement: "Portfolio requirement",
  language: "Program language",
  page_content: "Page content",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}
