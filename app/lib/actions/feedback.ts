"use server";

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { FeedbackCategory } from "@/app/lib/supabase/database.types";

export interface FeedbackActionResult {
  error?: string;
}

const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "confusing",
  "wrong_information",
  "missing_university",
  "bug",
  "feature_request",
  "other",
];

/** Public Beta feedback (AGENTS.md section 18) -- available to guests too:
 * `user_feedback_insert_any`'s RLS check allows a null user_id, so this
 * works whether or not the caller is signed in. */
export async function submitFeedbackAction(
  _locale: AppLocale,
  params: { category: FeedbackCategory; message: string; pagePath: string },
): Promise<FeedbackActionResult> {
  const message = params.message.trim();
  if (!message) return { error: "Please add a short description." };
  if (!FEEDBACK_CATEGORIES.includes(params.category)) return { error: "Invalid category." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("user_feedback").insert({
    user_id: user?.id ?? null,
    category: params.category,
    message,
    page_path: params.pagePath || null,
  });
  if (error) return { error: error.message };

  return {};
}
