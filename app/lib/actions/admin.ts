"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { requireAdmin, AdminAuthError } from "@/app/lib/supabase/roles";
import { createAdminClient, hasServiceRoleEnv } from "@/app/lib/supabase/admin";
import { logAdminAction } from "@/app/lib/data/adminAudit";
import { applyApprovedChange } from "@/app/lib/data/adminChanges";
import { checkSource } from "@/app/lib/live-data/checkSource";
import { computeNextCheckDueAt } from "@/app/lib/live-data/sourceStatus";

export interface AdminActionResult {
  error?: string;
}

/**
 * Every function in this file is a Server Action reachable directly by a
 * signed-in client regardless of which page rendered the button that calls
 * it -- so every one independently re-verifies `requireAdmin()` first (task
 * brief item 27: "Admin server actions: 必ず authenticated + role === admin
 * をserver-sideで確認"). Never trust that only the /admin UI can reach these.
 */
async function withAdmin<T>(
  run: (adminUserId: string) => Promise<T>,
): Promise<T | AdminActionResult> {
  if (!hasServiceRoleEnv()) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set." };
  try {
    const { user } = await requireAdmin();
    return await run(user.id);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return { error: err.reason === "unauthenticated" ? "Not authenticated." : "Admin role required." };
    }
    return { error: err instanceof Error ? err.message : "Admin action failed." };
  }
}

export async function verifyProgramAction(locale: AppLocale, programId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("programs")
      .update({ verified_at: new Date().toISOString(), needs_review: false })
      .eq("id", programId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "PROGRAM_VERIFIED", entityType: "program", entityId: programId });
    revalidatePath(`/${locale}/admin/programs`);
    return {};
  });
  return result as AdminActionResult;
}

export async function flagProgramNeedsReviewAction(locale: AppLocale, programId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("programs").update({ needs_review: true }).eq("id", programId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "PROGRAM_FLAGGED_NEEDS_REVIEW", entityType: "program", entityId: programId });
    revalidatePath(`/${locale}/admin/programs`);
    return {};
  });
  return result as AdminActionResult;
}

/**
 * Admin "Verify" action for a university's official-website source (task
 * brief item 11/12): an explicit human override for the rare case an
 * admin has personally confirmed the page is legitimate but the automated
 * checker can't say so on its own (e.g. the site blocks bots but a human
 * browser loads it fine). Deliberately still writes into the same
 * `sources.url_status` column checkSource()/validateSource() use -- there is
 * no separate "admin-verified" flag to keep in sync (see dataStatus.ts's
 * note on avoiding a second place for the truth to drift) -- but the audit
 * log entry is what distinguishes "verified by an automated HTTP check" from
 * "verified by an admin" after the fact (task brief item 19's
 * `verification_method`).
 */
export async function manuallyVerifyUniversitySourceAction(
  locale: AppLocale,
  sourceId: string,
  universityId: string,
): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("sources")
      .update({
        url_status: "valid",
        validation_error: null,
        consecutive_failures: 0,
        last_checked_at: now,
        last_validated_at: now,
        last_successful_check_at: now,
        admin_rejected: false,
        admin_rejected_at: null,
        admin_rejected_by: null,
        next_check_due_at: computeNextCheckDueAt("valid", "university", 0),
      })
      .eq("id", sourceId);
    if (error) return { error: error.message };

    await logAdminAction({
      adminUserId,
      action: "UNIVERSITY_SOURCE_MANUALLY_VERIFIED",
      entityType: "university",
      entityId: universityId,
      metadata: { sourceId, verificationMethod: "admin_manual" },
    });
    revalidatePath(`/${locale}/admin/universities`);
    revalidatePath(`/${locale}/admin/universities/${universityId}`);
    return {};
  });
  return result as AdminActionResult;
}

/** "Keep Needs Review" (task brief item 11): a pure audit-trail entry --
 * an admin looked at this record and decided it genuinely isn't ready yet,
 * as distinct from simply never having been reviewed. No catalog data
 * changes; this only feeds Verification History (task brief item 19/20). */
export interface UniversityStudentStatsInput {
  totalStudents: number | null;
  internationalStudents: number | null;
  internationalStudentPercentage: number | null;
  academicYear: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

/** Personalized Planning Phase 1, task item 6: the only way international
 * student statistics ever enter `universities` -- no automated importer
 * exists for this data (no specified source of truth), so every figure is
 * admin-entered and stamped with a real `last_verified_at` at write time.
 * Any field left null renders as "Being verified" in the UI, never an
 * estimate. */
export async function updateUniversityStudentStatsAction(
  locale: AppLocale,
  universityId: string,
  input: UniversityStudentStatsInput,
): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("universities")
      .update({
        total_students: input.totalStudents,
        international_students: input.internationalStudents,
        international_student_percentage: input.internationalStudentPercentage,
        student_stats_academic_year: input.academicYear,
        student_stats_source_name: input.sourceName,
        student_stats_source_url: input.sourceUrl,
        student_stats_last_verified_at: new Date().toISOString(),
      })
      .eq("id", universityId);
    if (error) return { error: error.message };

    await logAdminAction({
      adminUserId,
      action: "UNIVERSITY_STUDENT_STATS_UPDATED",
      entityType: "university",
      entityId: universityId,
    });
    revalidatePath(`/${locale}/admin/universities/${universityId}`);
    revalidatePath(`/${locale}/universities/${universityId}/student-reality`);
    return {};
  });
  return result as AdminActionResult;
}

export async function keepUniversityNeedsReviewAction(locale: AppLocale, universityId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    await logAdminAction({
      adminUserId,
      action: "UNIVERSITY_KEPT_NEEDS_REVIEW",
      entityType: "university",
      entityId: universityId,
    });
    revalidatePath(`/${locale}/admin/universities/${universityId}`);
    return {};
  });
  return result as AdminActionResult;
}

/** "Retry Validation" (task brief item 11): re-runs the same real HTTP check
 * checkSource() performs on a schedule, on demand, right now. */
export async function retryUniversitySourceValidationAction(
  locale: AppLocale,
  sourceId: string,
  universityId: string,
): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const checkResult = await checkSource(sourceId);
    await logAdminAction({
      adminUserId,
      action: "UNIVERSITY_SOURCE_REVALIDATED",
      entityType: "university",
      entityId: universityId,
      metadata: { sourceId, result: checkResult.status },
    });
    revalidatePath(`/${locale}/admin/universities`);
    revalidatePath(`/${locale}/admin/universities/${universityId}`);
    return {};
  });
  return result as AdminActionResult;
}

export async function rejectSourceAction(locale: AppLocale, sourceId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("sources")
      .update({ admin_rejected: true, admin_rejected_at: new Date().toISOString(), admin_rejected_by: adminUserId })
      .eq("id", sourceId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "SOURCE_REJECTED", entityType: "source", entityId: sourceId });
    revalidatePath(`/${locale}/admin/sources`);
    revalidatePath(`/${locale}/admin`);
    return {};
  });
  return result as AdminActionResult;
}

export async function unrejectSourceAction(locale: AppLocale, sourceId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("sources")
      .update({ admin_rejected: false, admin_rejected_at: null, admin_rejected_by: null })
      .eq("id", sourceId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "SOURCE_UNREJECTED", entityType: "source", entityId: sourceId });
    revalidatePath(`/${locale}/admin/sources`);
    revalidatePath(`/${locale}/admin`);
    return {};
  });
  return result as AdminActionResult;
}

export async function approveChangeEventAction(locale: AppLocale, changeEventId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { data: change, error: fetchError } = await admin
      .from("change_events")
      .select("*")
      .eq("id", changeEventId)
      .maybeSingle();
    if (fetchError || !change) return { error: fetchError?.message ?? "Change event not found." };

    const applyResult = await applyApprovedChange(admin, change);

    const { error: updateError } = await admin
      .from("change_events")
      .update({ review_status: applyResult.applied ? "applied" : "approved" })
      .eq("id", changeEventId);
    if (updateError) return { error: updateError.message };

    await logAdminAction({
      adminUserId,
      action: "CHANGE_APPROVED",
      entityType: "change_event",
      entityId: changeEventId,
      metadata: {
        fieldName: change.field_name,
        oldValue: change.old_value,
        newValue: change.new_value,
        applied: applyResult.applied,
        applyFailureReason: applyResult.reason ?? null,
      },
    });
    revalidatePath(`/${locale}/admin/changes`);
    revalidatePath(`/${locale}/admin`);

    if (!applyResult.applied) {
      return { error: `Approved, but could not write the new value automatically: ${applyResult.reason}` };
    }
    return {};
  });
  return result as AdminActionResult;
}

export async function rejectChangeEventAction(locale: AppLocale, changeEventId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("change_events").update({ review_status: "rejected" }).eq("id", changeEventId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "CHANGE_REJECTED", entityType: "change_event", entityId: changeEventId });
    revalidatePath(`/${locale}/admin/changes`);
    revalidatePath(`/${locale}/admin`);
    return {};
  });
  return result as AdminActionResult;
}

export async function resolveReportAction(locale: AppLocale, reportId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("community_reports").update({ status: "resolved" }).eq("id", reportId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "REPORT_RESOLVED", entityType: "community_report", entityId: reportId });
    revalidatePath(`/${locale}/admin/community`);
    revalidatePath(`/${locale}/admin`);
    return {};
  });
  return result as AdminActionResult;
}

export async function markFeedbackReviewedAction(locale: AppLocale, feedbackId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("user_feedback").update({ status: "reviewed" }).eq("id", feedbackId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "FEEDBACK_REVIEWED", entityType: "user_feedback", entityId: feedbackId });
    revalidatePath(`/${locale}/admin/feedback`);
    return {};
  });
  return result as AdminActionResult;
}

export async function dismissReportAction(locale: AppLocale, reportId: string): Promise<AdminActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("community_reports").update({ status: "dismissed" }).eq("id", reportId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "REPORT_DISMISSED", entityType: "community_report", entityId: reportId });
    revalidatePath(`/${locale}/admin/community`);
    revalidatePath(`/${locale}/admin`);
    return {};
  });
  return result as AdminActionResult;
}
