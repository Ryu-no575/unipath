"use server";

import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { encodeMatchQuizAnswers } from "@/app/lib/match/query";
import type { MatchQuizAnswers } from "@/app/lib/match/types";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";

/** Best-effort only: the match_preferences table (see
 * supabase/migrations/20260826200000_match_preferences.sql) is not required
 * for the Match Quiz -> Results flow, which carries answers via the results
 * URL instead. Swallowing the error here means the feature keeps working
 * even before that migration has been applied -- persistence (e.g. a future
 * "resume your last match" entry point) simply starts working once it has. */
async function persistMatchPreferences(userId: string, answers: MatchQuizAnswers) {
  const supabase = await createClient();
  const { error } = await supabase.from("match_preferences").upsert(
    {
      user_id: userId,
      campus_environment: answers.campusEnvironment,
      class_size_preference: answers.classSizePreference,
      climate_preference: answers.climatePreference,
      work_while_studying_importance: answers.workWhileStudyingImportance,
      scholarship_need: answers.scholarshipNeed,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("match_preferences upsert failed (non-fatal):", error.message);
  }
}

// persistMatchPreferences never throws (it swallows its own error, see
// above), and the only other early exit is a redirect -- so unlike
// completeOnboardingAction this never has a failure to report back to the
// caller, and returns nothing.
export async function submitMatchQuizAction(locale: AppLocale, answers: MatchQuizAnswers): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  await persistMatchPreferences(user.id, answers);
  await recordAnalyticsEvent(supabase, user.id, "match_completed");

  redirect(`/${locale}/explore/match/results?${encodeMatchQuizAnswers(answers)}`);
}
