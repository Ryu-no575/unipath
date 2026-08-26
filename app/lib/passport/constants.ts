import type { DocumentStatus } from "@/app/lib/supabase/database.types";

export const DOCUMENT_STATUSES: DocumentStatus[] = ["draft", "ready", "submitted", "expired"];

export interface StatusStyle {
  badgeClass: string;
}

export const DOCUMENT_STATUS_STYLES: Record<DocumentStatus, StatusStyle> = {
  draft: { badgeClass: "bg-zinc-100 text-zinc-600" },
  ready: { badgeClass: "bg-emerald-50 text-emerald-700" },
  submitted: { badgeClass: "bg-blue-50 text-blue-700" },
  expired: { badgeClass: "bg-red-50 text-red-700" },
};
