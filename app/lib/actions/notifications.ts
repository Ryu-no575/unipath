"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";

export interface NotificationActionResult {
  error?: string;
}

function revalidateNotificationPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/notifications`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function markNotificationReadAction(
  locale: AppLocale,
  notificationId: string,
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .eq("read", false)
    .select("id");
  if (error) return { error: error.message };

  if (data && data.length > 0) {
    revalidateNotificationPaths(locale);
  }
  return {};
}

export async function markAllNotificationsReadAction(
  locale: AppLocale,
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  if (error) return { error: error.message };

  revalidateNotificationPaths(locale);
  return {};
}
