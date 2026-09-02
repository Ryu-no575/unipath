"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { SecondaryQualificationType } from "@/app/lib/supabase/database.types";

export interface EducationFormInput {
  institutionName: string;
  countryCode: string;
  educationLevel: string;
  qualificationType: SecondaryQualificationType | "";
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  graduationDate: string;
  gpaValue: string;
  gpaScale: string;
}

export interface PassportActionResult {
  error?: string;
}

function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toNullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function revalidatePassportPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/passport`);
  revalidatePath(`/${locale}/passport/education`);
}

export async function createEducationAction(
  locale: AppLocale,
  input: EducationFormInput,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const institutionName = input.institutionName.trim();
  if (!institutionName) return { error: "Institution name is required." };

  const { error } = await supabase.from("education_history").insert({
    user_id: user.id,
    institution_name: institutionName,
    country_code: toNullableString(input.countryCode),
    education_level: toNullableString(input.educationLevel),
    qualification_type: input.qualificationType || null,
    field_of_study: toNullableString(input.fieldOfStudy),
    start_date: toNullableString(input.startDate),
    end_date: toNullableString(input.endDate),
    graduation_date: toNullableString(input.graduationDate),
    gpa_value: toNullableNumber(input.gpaValue),
    gpa_scale: toNullableNumber(input.gpaScale),
  });
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}

export async function updateEducationAction(
  locale: AppLocale,
  id: string,
  input: EducationFormInput,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const institutionName = input.institutionName.trim();
  if (!institutionName) return { error: "Institution name is required." };

  const { error } = await supabase
    .from("education_history")
    .update({
      institution_name: institutionName,
      country_code: toNullableString(input.countryCode),
      education_level: toNullableString(input.educationLevel),
      qualification_type: input.qualificationType || null,
      field_of_study: toNullableString(input.fieldOfStudy),
      start_date: toNullableString(input.startDate),
      end_date: toNullableString(input.endDate),
      graduation_date: toNullableString(input.graduationDate),
      gpa_value: toNullableNumber(input.gpaValue),
      gpa_scale: toNullableNumber(input.gpaScale),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}

export async function deleteEducationAction(
  locale: AppLocale,
  id: string,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("education_history").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}
