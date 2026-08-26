import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface NotificationSummary {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  changeEventId: string | null;
  communityPostId: string | null;
  communityCommentId: string | null;
}

export async function getUnreadNotificationCount(supabase: Client, userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

/** Bundles the two queries every layout needs to render the notification
 * bell (unread count + preview list) into one call. */
export async function getNotificationBellData(
  supabase: Client,
  userId: string,
): Promise<{ unreadCount: number; recentNotifications: NotificationSummary[] }> {
  const [unreadCount, recentNotifications] = await Promise.all([
    getUnreadNotificationCount(supabase, userId),
    getRecentNotifications(supabase, userId),
  ]);
  return { unreadCount, recentNotifications };
}

export async function getRecentNotifications(
  supabase: Client,
  userId: string,
  limit = 5,
): Promise<NotificationSummary[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toSummary);
}

export async function getNotificationsForUser(
  supabase: Client,
  userId: string,
  limit = 50,
): Promise<NotificationSummary[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toSummary);
}

function toSummary(row: Database["public"]["Tables"]["notifications"]["Row"]): NotificationSummary {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
    changeEventId: row.change_event_id,
    communityPostId: row.community_post_id,
    communityCommentId: row.community_comment_id,
  };
}

export interface NotificationDetail extends NotificationSummary {
  changeEvent: {
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    importance: Database["public"]["Tables"]["change_events"]["Row"]["importance"];
    reviewStatus: Database["public"]["Tables"]["change_events"]["Row"]["review_status"];
    detectedAt: string;
    entityType: Database["public"]["Tables"]["change_events"]["Row"]["entity_type"];
    entityId: string;
  } | null;
  universityName: string | null;
  programName: string | null;
  officialUrl: string | null;
  sourcePublisher: string | null;
  /** Set when this notification is about a Community post/comment -- lets
   * the detail page link straight to "/universities/{id}/community/{postId}"
   * instead of only showing the title/message text. */
  communityUniversityId: string | null;
}

/** Full detail for one notification: what changed, when, which program it
 * affects, and its official source -- everything the Notifications UI needs
 * to answer "what changed / when / which program / official source". */
export async function getNotificationDetail(
  supabase: Client,
  userId: string,
  notificationId: string,
): Promise<NotificationDetail | null> {
  const { data: notification } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!notification) return null;

  const base = toSummary(notification);

  let communityUniversityId: string | null = null;
  if (notification.community_post_id) {
    const { data: post } = await supabase
      .from("community_posts")
      .select("university_id")
      .eq("id", notification.community_post_id)
      .maybeSingle();
    communityUniversityId = post?.university_id ?? null;
  }

  if (!notification.change_event_id) {
    return {
      ...base,
      changeEvent: null,
      universityName: null,
      programName: null,
      officialUrl: null,
      sourcePublisher: null,
      communityUniversityId,
    };
  }

  const { data: changeEvent } = await supabase
    .from("change_events")
    .select("*")
    .eq("id", notification.change_event_id)
    .maybeSingle();
  if (!changeEvent) {
    return {
      ...base,
      changeEvent: null,
      universityName: null,
      programName: null,
      officialUrl: null,
      sourcePublisher: null,
      communityUniversityId,
    };
  }

  const [{ universityName, programName }, source] = await Promise.all([
    resolveEntityNames(supabase, changeEvent.entity_type, changeEvent.entity_id),
    changeEvent.source_id
      ? supabase.from("sources").select("official_url, resolved_url, publisher").eq("id", changeEvent.source_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...base,
    changeEvent: {
      fieldName: changeEvent.field_name,
      oldValue: changeEvent.old_value,
      newValue: changeEvent.new_value,
      importance: changeEvent.importance,
      reviewStatus: changeEvent.review_status,
      detectedAt: changeEvent.detected_at,
      entityType: changeEvent.entity_type,
      entityId: changeEvent.entity_id,
    },
    universityName,
    programName,
    officialUrl: source.data?.resolved_url ?? source.data?.official_url ?? null,
    sourcePublisher: source.data?.publisher ?? null,
    communityUniversityId,
  };
}

export async function resolveEntityNames(
  supabase: Client,
  entityType: Database["public"]["Tables"]["change_events"]["Row"]["entity_type"],
  entityId: string,
): Promise<{ universityName: string | null; programName: string | null }> {
  if (entityType === "university") {
    const { data } = await supabase.from("universities").select("official_name").eq("id", entityId).maybeSingle();
    return { universityName: data?.official_name ?? null, programName: null };
  }
  if (entityType === "program") {
    const { data: program } = await supabase
      .from("programs")
      .select("official_name, university_id")
      .eq("id", entityId)
      .maybeSingle();
    if (!program) return { universityName: null, programName: null };
    const { data: university } = await supabase
      .from("universities")
      .select("official_name")
      .eq("id", program.university_id)
      .maybeSingle();
    return { universityName: university?.official_name ?? null, programName: program.official_name };
  }
  const { data: cycle } = await supabase
    .from("admission_cycles")
    .select("program_id")
    .eq("id", entityId)
    .maybeSingle();
  if (!cycle) return { universityName: null, programName: null };
  return resolveEntityNames(supabase, "program", cycle.program_id);
}
