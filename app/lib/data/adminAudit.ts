import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";

/** Task brief item 22's example action names -- not an exhaustive enum (the
 * column is plain `text`, see 20260829000000_admin_roles_v1.sql), just the
 * vocabulary this codebase's admin actions currently emit. */
export type AdminAuditAction =
  | "PROGRAM_VERIFIED"
  | "PROGRAM_FLAGGED_NEEDS_REVIEW"
  | "SOURCE_REJECTED"
  | "SOURCE_UNREJECTED"
  | "CHANGE_APPROVED"
  | "CHANGE_REJECTED"
  | "REPORT_RESOLVED"
  | "REPORT_DISMISSED"
  | "ADMIN_ROLE_GRANTED"
  | "ADMIN_ROLE_REVOKED"
  | "UNIVERSITY_SOURCE_MANUALLY_VERIFIED"
  | "UNIVERSITY_KEPT_NEEDS_REVIEW"
  | "UNIVERSITY_SOURCE_REVALIDATED"
  | "UNIVERSITY_STUDENT_STATS_UPDATED"
  | "VISA_PROFILE_CREATED"
  | "VISA_PROFILE_UPDATED"
  | "VISA_ITEM_ADDED"
  | "VISA_ITEM_REMOVED"
  | "VISA_SOURCE_ADDED"
  | "FEEDBACK_REVIEWED";

export type AdminAuditEntityType =
  | "program"
  | "source"
  | "change_event"
  | "community_report"
  | "user_role"
  | "university"
  | "visa_requirement_profile"
  | "user_feedback";

/**
 * Durable record of a privileged admin action (task brief item 22). Never
 * throws into the caller's action flow -- an audit-log write failure must
 * never block or roll back the admin action it's describing, only be logged
 * server-side for operators to notice.
 */
export async function logAdminAction(params: {
  adminUserId: string;
  action: AdminAuditAction;
  entityType: AdminAuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("admin_audit_logs").insert({
      admin_user_id: params.adminUserId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("[admin_audit_logs] failed to write audit entry", err);
  }
}
