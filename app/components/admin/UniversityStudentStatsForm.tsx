"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { updateUniversityStudentStatsAction } from "@/app/lib/actions/admin";
import type { AdminUniversityDetail } from "@/app/lib/data/adminUniversityDetail";

const inputClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

function toNullableInt(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toNullableFloat(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Task item 6: the only entry point for `universities.total_students`/
 * `international_students`/etc. -- no automated importer exists for this
 * data. Every field left blank is stored as null and renders as "Being
 * verified" on the public student-reality page, never an estimate. */
export default function UniversityStudentStatsForm({
  universityId,
  studentStats,
}: {
  universityId: string;
  studentStats: AdminUniversityDetail["studentStats"];
}) {
  const t = useTranslations("AdminUniversityDetail");
  const locale = useLocale() as AppLocale;
  const [totalStudents, setTotalStudents] = useState(studentStats.totalStudents?.toString() ?? "");
  const [internationalStudents, setInternationalStudents] = useState(
    studentStats.internationalStudents?.toString() ?? "",
  );
  const [percentage, setPercentage] = useState(studentStats.internationalStudentPercentage?.toString() ?? "");
  const [academicYear, setAcademicYear] = useState(studentStats.academicYear ?? "");
  const [sourceName, setSourceName] = useState(studentStats.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(studentStats.sourceUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateUniversityStudentStatsAction(locale, universityId, {
        totalStudents: toNullableInt(totalStudents),
        internationalStudents: toNullableInt(internationalStudents),
        internationalStudentPercentage: toNullableFloat(percentage),
        academicYear: toNullableString(academicYear),
        sourceName: toNullableString(sourceName),
        sourceUrl: toNullableString(sourceUrl),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("studentStatsTotalLabel")}</span>
          <input type="number" min={0} value={totalStudents} onChange={(e) => setTotalStudents(e.target.value)} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("studentStatsInternationalLabel")}</span>
          <input
            type="number"
            min={0}
            value={internationalStudents}
            onChange={(e) => setInternationalStudents(e.target.value)}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("studentStatsPercentageLabel")}</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("studentStatsAcademicYearLabel")}</span>
          <input
            type="text"
            placeholder="2025/26"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("studentStatsSourceNameLabel")}</span>
          <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("studentStatsSourceUrlLabel")}</span>
          <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputClasses} />
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {saved && !isPending && <p className="text-xs text-emerald-600">{t("studentStatsSaved")}</p>}
      {studentStats.lastVerifiedAt && (
        <p className="text-xs text-zinc-400">
          {t("studentStatsLastVerified", { date: new Date(studentStats.lastVerifiedAt).toLocaleString(locale) })}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {isPending ? t("studentStatsSaving") : t("studentStatsSave")}
      </button>
    </form>
  );
}
