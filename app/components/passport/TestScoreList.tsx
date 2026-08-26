"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database } from "@/app/lib/supabase/database.types";
import TestScoreForm from "./TestScoreForm";
import TestScoreRow from "./TestScoreRow";

type TestScoreRowData = Database["public"]["Tables"]["test_scores"]["Row"];

export default function TestScoreList({
  locale,
  testScores,
}: {
  locale: AppLocale;
  testScores: TestScoreRowData[];
}) {
  const t = useTranslations("PassportTests");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">{t("additionalHeading")}</h2>
        {editingId !== "new" && (
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {t("addTest")}
          </button>
        )}
      </div>

      {editingId === "new" && <TestScoreForm locale={locale} onDone={() => setEditingId(null)} />}

      {testScores.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100">
          {testScores.map((entry) =>
            editingId === entry.id ? (
              <li key={entry.id} className="py-3">
                <TestScoreForm locale={locale} entry={entry} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <TestScoreRow key={entry.id} locale={locale} entry={entry} onEdit={() => setEditingId(entry.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
