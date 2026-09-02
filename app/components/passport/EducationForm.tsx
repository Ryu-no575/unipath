"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database, SecondaryQualificationType } from "@/app/lib/supabase/database.types";
import {
  createEducationAction,
  updateEducationAction,
  type EducationFormInput,
} from "@/app/lib/actions/passport-education";

type EducationRowData = Database["public"]["Tables"]["education_history"]["Row"];

const QUALIFICATION_TYPES: SecondaryQualificationType[] = [
  "national_secondary_diploma",
  "ib_diploma",
  "a_levels",
  "abitur",
  "french_baccalaureat",
  "other_national_secondary",
  "bachelor_degree",
  "master_degree",
];

const fieldClasses =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-xs font-medium text-zinc-600";

function toFormValues(entry?: EducationRowData): EducationFormInput {
  return {
    institutionName: entry?.institution_name ?? "",
    countryCode: entry?.country_code ?? "",
    educationLevel: entry?.education_level ?? "",
    qualificationType: entry?.qualification_type ?? "",
    fieldOfStudy: entry?.field_of_study ?? "",
    startDate: entry?.start_date ?? "",
    endDate: entry?.end_date ?? "",
    graduationDate: entry?.graduation_date ?? "",
    gpaValue: entry?.gpa_value != null ? String(entry.gpa_value) : "",
    gpaScale: entry?.gpa_scale != null ? String(entry.gpa_scale) : "",
  };
}

export default function EducationForm({
  locale,
  entry,
  onDone,
}: {
  locale: AppLocale;
  entry?: EducationRowData;
  onDone: () => void;
}) {
  const t = useTranslations("PassportEducation");
  const qualificationTypeT = useTranslations("QualificationTypeOptions");
  const [values, setValues] = useState<EducationFormInput>(toFormValues(entry));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof EducationFormInput>(key: K, value: EducationFormInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = entry
        ? await updateEducationAction(locale, entry.id, values)
        : await createEducationAction(locale, values);
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
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClasses}>{t("institutionNameLabel")}</span>
          <input
            type="text"
            value={values.institutionName}
            onChange={(e) => set("institutionName", e.target.value)}
            required
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("countryLabel")}</span>
          <input
            type="text"
            value={values.countryCode}
            onChange={(e) => set("countryCode", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("levelLabel")}</span>
          <input
            type="text"
            value={values.educationLevel}
            onChange={(e) => set("educationLevel", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("qualificationTypeLabel")}</span>
          <select
            value={values.qualificationType}
            onChange={(e) => set("qualificationType", e.target.value as SecondaryQualificationType | "")}
            className={fieldClasses}
          >
            <option value="">{t("qualificationTypeNone")}</option>
            {QUALIFICATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {qualificationTypeT(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClasses}>{t("fieldLabel")}</span>
          <input
            type="text"
            value={values.fieldOfStudy}
            onChange={(e) => set("fieldOfStudy", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("startDateLabel")}</span>
          <input
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("endDateLabel")}</span>
          <input
            type="date"
            value={values.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("graduationDateLabel")}</span>
          <input
            type="date"
            value={values.graduationDate}
            onChange={(e) => set("graduationDate", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("gpaValueLabel")}</span>
          <input
            type="number"
            step="0.01"
            value={values.gpaValue}
            onChange={(e) => set("gpaValue", e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("gpaScaleLabel")}</span>
          <input
            type="number"
            step="0.01"
            value={values.gpaScale}
            onChange={(e) => set("gpaScale", e.target.value)}
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
          {isPending ? t("saving") : entry ? t("saveChanges") : t("addEducation")}
        </button>
      </div>
    </form>
  );
}
