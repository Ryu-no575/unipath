"use server";

import { createClient } from "@/app/lib/supabase/server";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";

/**
 * Fire-and-forget analytics for Explore's client-only "Saved" collection
 * (app/lib/explore/savedUniversities.ts stores the item itself in
 * localStorage -- there is no DB row to attach this event to). Only ever
 * called for a save (never an unsave) by SaveButton, which already requires
 * a logged-in user before this can be reached.
 */
export async function recordUniversitySavedAction(key: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await recordAnalyticsEvent(supabase, user.id, "university_saved", { key });
}
