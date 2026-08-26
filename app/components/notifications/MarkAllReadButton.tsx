"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { markAllNotificationsReadAction } from "@/app/lib/actions/notifications";

export default function MarkAllReadButton({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Notifications");
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          void markAllNotificationsReadAction(locale);
        })
      }
      className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50"
    >
      {t("markAllRead")}
    </button>
  );
}
