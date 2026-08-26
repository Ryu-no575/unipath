import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeImportance, Database } from "@/app/lib/supabase/database.types";
import { fieldLabel } from "@/app/lib/live-data/field-labels";
import { resolveEntityNames } from "./notifications";

type Client = SupabaseClient<Database>;
type ChangeEventRow = Database["public"]["Tables"]["change_events"]["Row"];

export interface LatestUpdateItem {
  id: string;
  universityName: string | null;
  programName: string | null;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  importance: ChangeImportance;
  detectedAt: string;
  officialUrl: string | null;
  sourcePublisher: string | null;
}

/** Latest official-source changes behind this user's notifications feed.
 * Reads the same `notifications` rows the Notifications page reads (see
 * app/lib/data/notifications.ts:getNotificationsForUser), instead of
 * re-deriving eligibility from watch_subscriptions -- a user who has since
 * unwatched a program would otherwise still show a notification but see it
 * silently vanish from Dashboard. Powers the Dashboard "Latest Updates"
 * feed. */
export async function getLatestUpdatesForUser(
  supabase: Client,
  userId: string,
  limit = 5,
): Promise<LatestUpdateItem[]> {
  const { data: notifications } = await supabase
    .from("notifications")
    .select("change_event_id, created_at")
    .eq("user_id", userId)
    .not("change_event_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!notifications || notifications.length === 0) return [];

  const changeEventIds = uniqueIds(notifications.map((n) => n.change_event_id));
  if (changeEventIds.length === 0) return [];

  const { data: changeEvents } = await supabase
    .from("change_events")
    .select("*")
    .in("id", changeEventIds);
  const eventById = new Map((changeEvents ?? []).map((e) => [e.id, e]));

  const events = notifications
    .map((n) => (n.change_event_id ? eventById.get(n.change_event_id) : undefined))
    .filter((e): e is ChangeEventRow => Boolean(e));

  if (events.length === 0) return [];

  const sourceIds = uniqueIds(events.map((e) => e.source_id));
  const { data: sources } =
    sourceIds.length > 0
      ? await supabase.from("sources").select("id, official_url, resolved_url, publisher").in("id", sourceIds)
      : { data: [] };
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));

  return Promise.all(
    events.map(async (event) => {
      const { universityName, programName } = await resolveEntityNames(supabase, event.entity_type, event.entity_id);
      const source = event.source_id ? sourceById.get(event.source_id) : null;
      return {
        id: event.id,
        universityName,
        programName,
        fieldLabel: fieldLabel(event.field_name),
        oldValue: event.old_value,
        newValue: event.new_value,
        importance: event.importance,
        detectedAt: event.detected_at,
        officialUrl: source?.resolved_url ?? source?.official_url ?? null,
        sourcePublisher: source?.publisher ?? null,
      };
    }),
  );
}

function uniqueIds(ids: (string | null)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}
