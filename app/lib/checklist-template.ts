import type { TaskType } from "./supabase/database.types";

/**
 * A generic starting checklist offered when a new Application is created.
 * These are *suggestions*, not an official university requirement list —
 * every item is optional and removable before the tasks are actually
 * created (see NewApplicationForm). Titles are translation keys resolved
 * against the "ChecklistTemplate" i18n namespace, never hardcoded English
 * strings written straight to the database.
 */
export type ChecklistTemplateKey =
  | "passport"
  | "transcript"
  | "languageCertificate"
  | "motivationLetter"
  | "recommendationLetter"
  | "portfolio"
  | "entranceExamination"
  | "applicationSubmitted"
  | "applicationFeePaid";

export interface ChecklistTemplateItem {
  key: ChecklistTemplateKey;
  taskType: TaskType;
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { key: "passport", taskType: "document" },
  { key: "transcript", taskType: "document" },
  { key: "languageCertificate", taskType: "test" },
  { key: "motivationLetter", taskType: "document" },
  { key: "recommendationLetter", taskType: "recommendation" },
  { key: "portfolio", taskType: "document" },
  { key: "entranceExamination", taskType: "test" },
  { key: "applicationSubmitted", taskType: "application" },
  { key: "applicationFeePaid", taskType: "payment" },
];
