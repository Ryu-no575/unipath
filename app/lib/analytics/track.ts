import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsEventName, Database } from "@/app/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Best-effort product analytics (AGENTS.md section 19): fire-and-forget,
 * never throws into the caller's flow (mirrors app/lib/data/adminAudit.ts's
 * logAdminAction). `properties` must never carry Documents content or
 * anything personally identifying beyond the already-pseudonymous userId --
 * every call site here only ever passes small structural facts (a locale, a
 * route type, a category), never free text a user typed.
 */
export async function recordAnalyticsEvent(
  supabase: Client,
  userId: string | null,
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("analytics_events").insert({ user_id: userId, event_name: eventName, properties });
  } catch (err) {
    console.error("[analytics_events] failed to record event", eventName, err);
  }
}
