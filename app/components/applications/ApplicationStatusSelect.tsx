"use client";

import { useTransition, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { ApplicationStatus } from "@/app/lib/supabase/database.types";
import { updateApplicationStatusAction } from "@/app/lib/actions/applications";

const STATUSES: ApplicationStatus[] = [
  "considering",
  "preparing",
  "applied",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
];

export default function ApplicationStatusSelect({
  locale,
  applicationId,
  status,
}: {
  locale: AppLocale;
  applicationId: string;
  status: ApplicationStatus;
}) {
  const t = useTranslations("ApplicationStatusOptions");
  const [isPending, startTransition] = useTransition();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ApplicationStatus;
    startTransition(async () => {
      await updateApplicationStatusAction(locale, applicationId, next);
    });
  }

  return (
    <select
      defaultValue={status}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(s)}
        </option>
      ))}
    </select>
  );
}
