"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import type { ApplicationType, VisaItemKey } from "@/app/lib/supabase/database.types";
import { requireAdmin, AdminAuthError } from "@/app/lib/supabase/roles";
import { createAdminClient, hasServiceRoleEnv } from "@/app/lib/supabase/admin";
import { logAdminAction } from "@/app/lib/data/adminAudit";

export interface AdminVisaActionResult {
  error?: string;
  id?: string;
}

async function withAdmin<T extends AdminVisaActionResult>(run: (adminUserId: string) => Promise<T>): Promise<T | AdminVisaActionResult> {
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

/** Creates a new (nationality, destination, study level) visa profile --
 * starts "being_verified" with zero checklist items until an admin adds an
 * official source and curates the checklist from it (AGENTS.md's Visa Data
 * Rule: never pre-filled with an AI-guessed checklist). */
export async function createVisaProfileAction(
  locale: AppLocale,
  params: { nationalityCountry: string; destinationCountry: string; studyLevel: ApplicationType },
): Promise<AdminVisaActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("visa_requirement_profiles")
      .upsert(
        {
          nationality_country: params.nationalityCountry,
          destination_country: params.destinationCountry,
          study_level: params.studyLevel,
        },
        { onConflict: "nationality_country,destination_country,study_level", ignoreDuplicates: false },
      )
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not create visa profile." };

    await logAdminAction({ adminUserId, action: "VISA_PROFILE_CREATED", entityType: "visa_requirement_profile", entityId: data.id });
    revalidatePath(`/${locale}/admin/visa`);
    return { id: data.id };
  });
  return result;
}

export async function updateVisaProfileAction(
  locale: AppLocale,
  profileId: string,
  params: { visaType: string; summary: string; status: "verified" | "being_verified" },
): Promise<AdminVisaActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin
      .from("visa_requirement_profiles")
      .update({
        visa_type: params.visaType.trim() || null,
        summary: params.summary.trim() || null,
        status: params.status,
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", profileId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "VISA_PROFILE_UPDATED", entityType: "visa_requirement_profile", entityId: profileId });
    revalidatePath(`/${locale}/admin/visa`);
    revalidatePath(`/${locale}/admin/visa/${profileId}`);
    return {};
  });
  return result;
}

export async function addVisaItemAction(
  locale: AppLocale,
  profileId: string,
  params: { itemKey: VisaItemKey; title: string; description: string; required: boolean; orderIndex: number },
): Promise<AdminVisaActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("visa_requirement_items").insert({
      visa_profile_id: profileId,
      item_key: params.itemKey,
      title: params.title.trim() || null,
      description: params.description.trim() || null,
      required: params.required,
      order_index: params.orderIndex,
    });
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "VISA_ITEM_ADDED", entityType: "visa_requirement_profile", entityId: profileId, metadata: { itemKey: params.itemKey } });
    revalidatePath(`/${locale}/admin/visa/${profileId}`);
    return {};
  });
  return result;
}

export async function deleteVisaItemAction(locale: AppLocale, profileId: string, itemId: string): Promise<AdminVisaActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { error } = await admin.from("visa_requirement_items").delete().eq("id", itemId);
    if (error) return { error: error.message };

    await logAdminAction({ adminUserId, action: "VISA_ITEM_REMOVED", entityType: "visa_requirement_profile", entityId: profileId, metadata: { itemId } });
    revalidatePath(`/${locale}/admin/visa/${profileId}`);
    return {};
  });
  return result;
}

/** Registers an official source (embassy/consulate/government immigration
 * site/university visa guidance) for this profile -- AGENTS.md section 4:
 * every visa requirement must trace to one of these, never AI memory.
 * Starts with url_status "unknown" until the admin runs Check Source Now
 * (checkSourceAction, already generic on sourceId -- reused as-is here). */
export async function addVisaSourceAction(
  locale: AppLocale,
  profileId: string,
  params: { url: string; title: string; publisher: string },
): Promise<AdminVisaActionResult> {
  const result = await withAdmin(async (adminUserId) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sources")
      .insert({
        source_type: "visa",
        page_type: "visa",
        visa_profile_id: profileId,
        official_url: params.url.trim(),
        title: params.title.trim() || null,
        publisher: params.publisher.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not add source." };

    await logAdminAction({ adminUserId, action: "VISA_SOURCE_ADDED", entityType: "visa_requirement_profile", entityId: profileId, metadata: { sourceId: data.id } });
    revalidatePath(`/${locale}/admin/visa/${profileId}`);
    return { id: data.id };
  });
  return result;
}
