import type { DocumentType, TestType } from "@/app/lib/supabase/database.types";
import type { ReadinessItem } from "./readiness";

/** Resolves the display label for a classified readiness item -- a document
 * type, a specific test type, or (for a generic "English test" requirement)
 * the English Certificate document label. Falls back to the requirement's
 * own source title when nothing was classified (should not normally be
 * called for "unknown" items, which have no actionable label). */
export function readinessItemLabel(
  item: Pick<ReadinessItem, "documentType" | "testHint" | "title">,
  documentTypeT: (key: DocumentType) => string,
  testTypeT: (key: TestType) => string,
): string {
  if (item.documentType) return documentTypeT(item.documentType);
  if (item.testHint === "english") return documentTypeT("english_certificate");
  if (item.testHint) return testTypeT(item.testHint);
  return item.title;
}
