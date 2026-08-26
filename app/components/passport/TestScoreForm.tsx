"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database, TestType } from "@/app/lib/supabase/database.types";
import { TEST_TYPES } from "@/app/lib/passport/readiness";
import {
  createTestScoreAction,
  updateTestScoreAction,
  type TestScoreFormInput,
} from "@/app/lib/actions/passport-tests";

type TestScoreRowData = Database["public"]["Tables"]["test_scores"]["Row"];

const fieldClasses =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-xs font-medium text-zinc-600";

function toFormValues(entry?: TestScoreRowData): TestScoreFormInput {
  return {
    testType: entry?.test_type ?? "ielts",
    overallScore: entry?.overall_score ?? "",
    testDate: entry?.test_date ?? "",
    expiresAt: entry?.expires_at ?? "",
  };
}

export default function TestScoreForm({
  locale,
  entry,
  onDone,
}: {
  locale: AppLocale;
  entry?: TestScoreRowData;
  onDone: () => void;
}) {
  const t = useTranslations("PassportTests");
  const testTypeT = useTranslations("TestTypeOptions");
  const [values, setValues] = useState<TestScoreFormInput>(toFormValues(entry));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof TestScoreFormInput>(key: K, value: TestScoreFormInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = entry
        ? await updateTestScoreAction(locale, entry.id, values)
        : await createTestScoreAction(locale, values);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("testTypeLabel")}</span>
          <select
            value={values.testType}
            onChange={(e) => set("testType", e.target.value as TestType)}
            className={fieldClasses}
          >
            {TEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {testTypeT(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("overallScoreLabel")}</span>
          <input
            type="text"
            value={values.overallScore}
            onChange={(e) => set("overallScore", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("testDateLabel")}</span>
          <input
            type="date"
            value={values.testDate}
            onChange={(e) => set("testDate", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("expiresAtLabel")}</span>
          <input
            type="date"
            value={values.expiresAt}
            onChange={(e) => set("expiresAt", e.target.value)}
            className={fieldClasses}
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("saving") : entry ? t("saveChanges") : t("addTest")}
        </button>
      </div>
    </form>
  );
}
