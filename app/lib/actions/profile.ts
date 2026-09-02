"use server";

import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { PRIORITY_TYPES, type ProfileFormValues } from "@/app/lib/profile-types";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";

function toNullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function saveProfile(values: ProfileFormValues) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert (not update): the profiles row is *supposed* to already exist
  // (created by the `handle_new_user` trigger on signup), but relying on
  // that silently no-ops an `update` for any user whose row is missing —
  // Postgres/PostgREST does not error when an UPDATE matches 0 rows. Upsert
  // makes profile saving correct regardless of that precondition.
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      self_reported_stage: values.selfReportedStage || null,
      nationality: toNullableString(values.nationality),
      residence_country: toNullableString(values.residenceCountry),
      preferred_locale: toNullableString(values.preferredLocale),
      timezone: toNullableString(values.timezone),
      application_type: values.applicationType || null,
      intake_year: toNullableNumber(values.intakeYear),
      intake_season: values.intakeSeason || null,
      field_of_study: toNullableString(values.fieldOfStudy),
      education_level: toNullableString(values.educationLevel),
      qualification_type: values.qualificationType || null,
      previous_institution: toNullableString(values.previousInstitution),
      gpa_value: toNullableNumber(values.gpaValue),
      gpa_scale: toNullableNumber(values.gpaScale),
      english_test_type: values.englishTestType || null,
      english_test_score: toNullableString(values.englishTestScore),
      max_tuition: toNullableNumber(values.maxTuition),
      tuition_currency: toNullableString(values.tuitionCurrency),
      max_living_cost: toNullableNumber(values.maxLivingCost),
      living_cost_currency: toNullableString(values.livingCostCurrency),
    },
    { onConflict: "user_id" },
  );

  if (profileError) throw new Error(profileError.message);

  // Destination preferences have no natural "update" — replace the set.
  const { error: deleteError } = await supabase
    .from("profile_destination_preferences")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) throw new Error(deleteError.message);

  if (values.destinationCountries.length > 0) {
    const { error: insertError } = await supabase
      .from("profile_destination_preferences")
      .insert(
        values.destinationCountries.map((country_code) => ({
          user_id: user.id,
          country_code,
        })),
      );
    if (insertError) throw new Error(insertError.message);
  }

  const { error: prioritiesError } = await supabase.from("profile_priorities").upsert(
    PRIORITY_TYPES.map((priority_type) => ({
      user_id: user.id,
      priority_type,
      weight: values.priorities[priority_type] ?? 3,
    })),
    { onConflict: "user_id,priority_type" },
  );
  if (prioritiesError) throw new Error(prioritiesError.message);
}

export interface ProfileActionResult {
  error?: string;
}

export async function completeOnboardingAction(
  locale: AppLocale,
  values: ProfileFormValues,
): Promise<ProfileActionResult> {
  try {
    await saveProfile(values);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Only flip the flag once every prior save has actually succeeded —
    // saveProfile() above throws (and we return early, without redirecting)
    // if any of the profiles/destinations/priorities writes failed.
    const { error: completionError } = await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (completionError) throw new Error(completionError.message);

    await recordAnalyticsEvent(supabase, user.id, "onboarding_completed", {
      selfReportedStage: values.selfReportedStage || null,
    });
  } catch (err) {
    // redirect() must not be called from inside a try/catch, so failures
    // return here instead — the caller keeps the wizard open with the
    // entered values and shows this message rather than bouncing the user
    // back to onboarding's first step.
    return { error: err instanceof Error ? err.message : "Failed to save your profile." };
  }

  redirect(`/${locale}/dashboard`);
}

export async function updateProfileAction(
  locale: AppLocale,
  values: ProfileFormValues,
): Promise<ProfileActionResult> {
  try {
    await saveProfile(values);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save your profile." };
  }

  redirect(`/${locale}/profile`);
}
