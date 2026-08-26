"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database } from "@/app/lib/supabase/database.types";
import { deleteEducationAction } from "@/app/lib/actions/passport-education";

type EducationRowData = Database["public"]["Tables"]["education_history"]["Row"];

export default function EducationRow({
  locale,
  entry,
  onEdit,
}: {
  locale: AppLocale;
  entry: EducationRowData;
  onEdit: () => void;
}) {
  const t = useTranslations("PassportEducation");
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (typeof window !== "undefined" && !window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      await deleteEducationAction(locale, entry.id);
    });
  }

  const dateRange = [entry.start_date, entry.end_date].filter(Boolean).join(" – ");

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-800">{entry.institution_name}</span>
        <span className="text-xs text-zinc-500">
          {[entry.education_level, entry.field_of_study, entry.country_code].filter(Boolean).join(" · ")}
        </span>
        {dateRange && <span className="text-xs text-zinc-400">{dateRange}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 hover:underline"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 hover:underline"
        >
          {t("delete")}
        </button>
      </div>
    </li>
  );
}
