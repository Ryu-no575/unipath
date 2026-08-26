"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { markNotificationReadAction } from "@/app/lib/actions/notifications";

/**
 * Marks a notification as read from the client after the detail page has
 * hydrated, instead of during Server Component render (which would call
 * revalidatePath mid-render -- unsupported, see markNotificationReadAction).
 */
export default function NotificationReadMarker({
  locale,
  notificationId,
}: {
  locale: AppLocale;
  notificationId: string;
}) {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    void markNotificationReadAction(locale, notificationId).then((result) => {
      if (!result.error) {
        router.refresh();
      }
    });
  }, [locale, notificationId, router]);

  return null;
}
