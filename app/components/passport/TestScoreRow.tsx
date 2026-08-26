"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database } from "@/app/lib/supabase/database.types";
import { deleteTestScoreAction } from "@/app/lib/actions/passport-tests";

type TestScoreRowData = Database["public"]["Tables"]["test_scores"]["Row"];

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return expiresAt < new Date().toISOString().slice(0, 10);
}

export default function TestScoreRow({
  locale,
  entry,
  onEdit,
}: {
  locale: AppLocale;
  entry: TestScoreRowData;
  onEdit: () => void;
}) {
  const t = useTranslations("PassportTests");
  const testTypeT = useTranslations("TestTypeOptions");
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (typeof window !== "undefined" && !window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      await deleteTestScoreAction(locale, entry.id);
    });
  }

  const expired = isExpired(entry.expires_at);

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          {testTypeT(entry.test_type)}
          {entry.overall_score ? ` · ${entry.overall_score}` : ""}
          {expired && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              {t("expired")}
            </span>
          )}
        </span>
        {(entry.test_date || entry.expires_at) && (
          <span className="text-xs text-zinc-400">
            {entry.test_date ? entry.test_date : ""}
            {entry.expires_at ? ` · ${t("expiresAtLabel")}: ${entry.expires_at}` : ""}
          </span>
        )}
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
