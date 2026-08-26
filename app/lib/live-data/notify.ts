import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";
import type { ChangeEntityType } from "@/app/lib/supabase/database.types";
import { fieldLabel } from "./field-labels";

async function resolveEntityName(
  supabase: ReturnType<typeof createAdminClient>,
  entityType: ChangeEntityType,
  entityId: string,
): Promise<string> {
  if (entityType === "university") {
    const { data } = await supabase.from("universities").select("official_name").eq("id", entityId).maybeSingle();
    return data?.official_name ?? "A university you're tracking";
  }
  if (entityType === "program") {
    const { data } = await supabase
      .from("programs")
      .select("official_name, university_id")
      .eq("id", entityId)
      .maybeSingle();
    if (!data) return "A program you're tracking";
    const { data: university } = await supabase
      .from("universities")
      .select("official_name")
      .eq("id", data.university_id)
      .maybeSingle();
    return university ? `${university.official_name} — ${data.official_name}` : data.official_name;
  }
  // admission_cycle
  const { data: cycle } = await supabase
    .from("admission_cycles")
    .select("program_id")
    .eq("id", entityId)
    .maybeSingle();
  if (!cycle) return "A program you're tracking";
  return resolveEntityName(supabase, "program", cycle.program_id);
}

async function resolveWatchingUserIds(
  supabase: ReturnType<typeof createAdminClient>,
  entityType: ChangeEntityType,
  entityId: string,
): Promise<string[]> {
  if (entityType === "university") {
    const { data } = await supabase
      .from("watch_subscriptions")
      .select("user_id")
      .eq("university_id", entityId)
      .eq("enabled", true);
    return [...new Set((data ?? []).map((row) => row.user_id))];
  }
  if (entityType === "program") {
    // A user can now hold more than one watch_subscriptions row per program
    // (one per admission cycle -- see 20260826230000_watch_subscription_hardening.sql),
    // so dedupe before fanning out notifications.
    const { data } = await supabase
      .from("watch_subscriptions")
      .select("user_id")
      .eq("program_id", entityId)
      .eq("enabled", true);
    return [...new Set((data ?? []).map((row) => row.user_id))];
  }
  // admission_cycle: match by the cycle's program, since a subscription is
  // keyed on program_id (see the migration's applications trigger).
  const { data: cycle } = await supabase
    .from("admission_cycles")
    .select("program_id")
    .eq("id", entityId)
    .maybeSingle();
  if (!cycle) return [];
  return resolveWatchingUserIds(supabase, "program", cycle.program_id);
}

/**
 * Turns one change_event into a notification for every user watching the
 * affected university/program (via watch_subscriptions). Only critical and
 * important changes page a user directly -- minor changes still show up in
 * that user's Latest Updates feed without a dedicated notification.
 */
export async function fanOutNotificationsForChangeEvent(changeEventId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: changeEvent } = await supabase
    .from("change_events")
    .select("*")
    .eq("id", changeEventId)
    .maybeSingle();
  if (!changeEvent || changeEvent.importance === "minor") return 0;

  const userIds = await resolveWatchingUserIds(supabase, changeEvent.entity_type, changeEvent.entity_id);
  if (userIds.length === 0) return 0;

  const entityName = await resolveEntityName(supabase, changeEvent.entity_type, changeEvent.entity_id);
  const label = fieldLabel(changeEvent.field_name);
  const title = `${entityName}: ${label} changed`;
  const message =
    changeEvent.old_value != null && changeEvent.new_value != null
      ? `${label} changed from "${changeEvent.old_value}" to "${changeEvent.new_value}" on the official source.`
      : `${label} was updated on the official source.`;

  const { error, count } = await supabase
    .from("notifications")
    .insert(
      userIds.map((userId) => ({
        user_id: userId,
        change_event_id: changeEvent.id,
        title,
        message,
        read: false,
      })),
      { count: "exact" },
    );

  return error ? 0 : (count ?? 0);
}
