import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { fieldLabel } from "@/app/lib/live-data/field-labels";
import { resolveEntityNames } from "./notifications";

type Client = SupabaseClient<Database>;
type ChangeEventRow = Database["public"]["Tables"]["change_events"]["Row"];

export interface ChangeEventDetail {
  id: string;
  universityName: string | null;
  programName: string | null;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  importance: ChangeEventRow["importance"];
  reviewStatus: ChangeEventRow["review_status"];
  detectedAt: string;
  officialUrl: string | null;
  sourcePublisher: string | null;
}

/** Full detail for one change_event -- what changed, when, which
 * University/Program, and its official source. Powers the standalone Change
 * detail page reached from Latest Updates' "View Change" link. A
 * change_event doesn't always have a notification (minor changes never fan
 * out, see app/lib/live-data/notify.ts), so this reads change_events
 * directly rather than joining through notifications. change_events is
 * public-read (see the verified_live_data_system migration), matching how
 * Latest Updates already surfaces the same rows to any signed-in user. */
export async function getChangeEventDetail(
  supabase: Client,
  changeEventId: string,
): Promise<ChangeEventDetail | null> {
  const { data: changeEvent } = await supabase
    .from("change_events")
    .select("*")
    .eq("id", changeEventId)
    .maybeSingle();
  if (!changeEvent) return null;

  const [{ universityName, programName }, source] = await Promise.all([
    resolveEntityNames(supabase, changeEvent.entity_type, changeEvent.entity_id),
    changeEvent.source_id
      ? supabase.from("sources").select("official_url, resolved_url, publisher").eq("id", changeEvent.source_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: changeEvent.id,
    universityName,
    programName,
    fieldName: changeEvent.field_name,
    fieldLabel: fieldLabel(changeEvent.field_name),
    oldValue: changeEvent.old_value,
    newValue: changeEvent.new_value,
    importance: changeEvent.importance,
    reviewStatus: changeEvent.review_status,
    detectedAt: changeEvent.detected_at,
    officialUrl: source.data?.resolved_url ?? source.data?.official_url ?? null,
    sourcePublisher: source.data?.publisher ?? null,
  };
}
