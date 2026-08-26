"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { TestType } from "@/app/lib/supabase/database.types";
import type { PassportActionResult } from "./passport-education";

export interface TestScoreFormInput {
  testType: TestType;
  overallScore: string;
  testDate: string;
  expiresAt: string;
}

function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function revalidatePassportPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/passport`);
  revalidatePath(`/${locale}/passport/tests`);
}

export async function createTestScoreAction(
  locale: AppLocale,
  input: TestScoreFormInput,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("test_scores").insert({
    user_id: user.id,
    test_type: input.testType,
    overall_score: toNullableString(input.overallScore),
    test_date: toNullableString(input.testDate),
    expires_at: toNullableString(input.expiresAt),
  });
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}

export async function updateTestScoreAction(
  locale: AppLocale,
  id: string,
  input: TestScoreFormInput,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("test_scores")
    .update({
      test_type: input.testType,
      overall_score: toNullableString(input.overallScore),
      test_date: toNullableString(input.testDate),
      expires_at: toNullableString(input.expiresAt),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}

export async function deleteTestScoreAction(
  locale: AppLocale,
  id: string,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("test_scores").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}
