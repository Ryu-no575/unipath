"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient, hasServiceRoleEnv } from "@/app/lib/supabase/admin";
import { getApplicationWithDetails } from "@/app/lib/data/applications";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";

export interface VisaActionResult {
  error?: string;
}

/**
 * Starts (or resumes) a Visa Journey for one accepted application. Finding
 * or creating the shared `visa_requirement_profiles` row for this
 * (nationality, destination, study level) combination needs the service-role
 * client -- ordinary users can only read that table (AGENTS.md's Visa Data
 * Rule: content is curated by an admin from an official source, never
 * user-writable) -- but a brand-new combination still needs *some* row to
 * exist, seeded as "being_verified" with zero checklist items until an admin
 * curates it, rather than blocking the user from starting at all.
 */
export async function startVisaJourneyAction(locale: AppLocale, applicationId: string): Promise<VisaActionResult> {
  if (!hasServiceRoleEnv()) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profileRow } = await supabase.from("profiles").select("nationality, application_type").eq("user_id", user.id).maybeSingle();
  if (!profileRow?.nationality) return { error: "Add your nationality in Profile before starting your Visa Journey." };
  if (!profileRow.application_type) return { error: "Add your study level in Profile before starting your Visa Journey." };

  const application = await getApplicationWithDetails(supabase, user.id, applicationId);
  if (!application) return { error: "Application not found." };
  if (!application.university?.countryCode) return { error: "This application has no known destination country yet." };
  if (application.status !== "accepted") return { error: "Visa preparation opens once an offer is accepted." };

  const admin = createAdminClient();

  const { data: visaProfile, error: profileError } = await admin
    .from("visa_requirement_profiles")
    .upsert(
      {
        nationality_country: profileRow.nationality,
        destination_country: application.university.countryCode,
        study_level: profileRow.application_type,
      },
      { onConflict: "nationality_country,destination_country,study_level", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (profileError || !visaProfile) return { error: profileError?.message ?? "Could not prepare visa requirements." };

  const { data: journey, error: journeyError } = await admin
    .from("user_visa_journeys")
    .upsert(
      { user_id: user.id, application_id: applicationId, visa_profile_id: visaProfile.id },
      { onConflict: "user_id,application_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (journeyError || !journey) return { error: journeyError?.message ?? "Could not start your Visa Journey." };

  await recordAnalyticsEvent(supabase, user.id, "visa_started", {
    destinationCountry: application.university.countryCode,
  });

  revalidatePath(`/${locale}/plan/visa`);
  redirect(`/${locale}/plan/visa/${journey.id}`);
}

export async function toggleVisaChecklistItemAction(
  locale: AppLocale,
  journeyId: string,
  itemId: string,
  completed: boolean,
): Promise<VisaActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("user_visa_checklist_progress").upsert(
    {
      user_visa_journey_id: journeyId,
      visa_item_id: itemId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_visa_journey_id,visa_item_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/plan/visa/${journeyId}`);
  revalidatePath(`/${locale}/dashboard`);
  return {};
}
