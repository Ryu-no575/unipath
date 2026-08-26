"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { IntakeSeason } from "@/app/lib/supabase/database.types";
import { getCountryOptions } from "@/app/lib/countries";
import { COMMON_TIMEZONES } from "@/app/lib/timezone";
import { CHECKLIST_TEMPLATE } from "@/app/lib/checklist-template";
import {
  createApplicationAction,
  type UniversitySelection,
} from "@/app/lib/actions/applications";

export interface CatalogUniversity {
  id: string;
  name: string;
  countryCode: string | null;
  /** "catalog" = UniPath's shared public.universities catalog (reused as-is);
   * "custom" = this user's own previously-added user_custom_universities row. */
  source: "catalog" | "custom";
}

export interface CatalogProgram {
  id: string;
  universityId: string;
  name: string;
  degreeType: string | null;
  field: string | null;
}

const DEGREE_TYPES = ["bachelor", "master", "phd", "exchange", "other"] as const;
const INTAKE_SEASONS: IntakeSeason[] = ["spring", "summer", "fall", "winter", "flexible"];

const fieldClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-sm font-medium text-zinc-700";

function Field({
  label,
  children,
  full = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className={labelClasses}>{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

export default function NewApplicationForm({
  locale,
  existingUniversities,
  existingPrograms,
  defaultUniversityName = "",
  defaultCountryCode = "",
  defaultField = "",
  defaultIntakeYear,
  defaultIntakeSeason,
}: {
  locale: AppLocale;
  existingUniversities: CatalogUniversity[];
  existingPrograms: CatalogProgram[];
  defaultUniversityName?: string;
  defaultCountryCode?: string;
  defaultField?: string;
  defaultIntakeYear?: number;
  defaultIntakeSeason?: IntakeSeason;
}) {
  const appLocale = useLocale();
  const t = useTranslations("NewApplication");
  const degreeOptions = useTranslations("DegreeOptions");
  const intakeSeasonOptions = useTranslations("IntakeSeasonOptions");
  const checklistT = useTranslations("ChecklistTemplate");
  const countryOptions = getCountryOptions(appLocale);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, i) => currentYear + i);

  const [universityName, setUniversityName] = useState(defaultUniversityName);
  const [country, setCountry] = useState(defaultCountryCode);
  const [city, setCity] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [programName, setProgramName] = useState("");
  const [degreeType, setDegreeType] = useState<string>("bachelor");
  const [field, setField] = useState(defaultField);
  const [intakeYear, setIntakeYear] = useState(String(defaultIntakeYear ?? currentYear));
  const [intakeSeason, setIntakeSeason] = useState<IntakeSeason>(
    defaultIntakeSeason ?? "fall",
  );
  const [deadline, setDeadline] = useState("");
  const [deadlineTimezone, setDeadlineTimezone] = useState("UTC");
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(
    () => new Set(CHECKLIST_TEMPLATE.map((item) => item.key)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matchedUniversity = useMemo(
    () =>
      existingUniversities.find(
        (u) => u.name.trim().toLowerCase() === universityName.trim().toLowerCase(),
      ) ?? null,
    [existingUniversities, universityName],
  );

  const programsForUniversity = useMemo(
    () =>
      matchedUniversity
        ? existingPrograms.filter((p) => p.universityId === matchedUniversity.id)
        : [],
    [existingPrograms, matchedUniversity],
  );

  const matchedProgram = useMemo(
    () =>
      programsForUniversity.find(
        (p) => p.name.trim().toLowerCase() === programName.trim().toLowerCase(),
      ) ?? null,
    [programsForUniversity, programName],
  );

  function toggleTask(key: string) {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const university: UniversitySelection = matchedUniversity
        ? matchedUniversity.source === "catalog"
          ? { kind: "catalog", universityId: matchedUniversity.id }
          : { kind: "custom", customUniversityId: matchedUniversity.id }
        : { kind: "customNew", name: universityName, countryCode: country, city, officialWebsite };

      const result = await createApplicationAction(locale, {
        university,
        programId: matchedUniversity?.source === "catalog" ? (matchedProgram?.id ?? null) : null,
        programName,
        degreeType,
        field,
        intakeYear: Number(intakeYear),
        intakeSeason,
        deadline,
        deadlineTimezone,
        suggestedTaskKeys: Array.from(checkedTasks),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label={t("universityLabel")} full hint={matchedUniversity ? t("universityExistingNote") : undefined}>
            <input
              type="text"
              list="university-options"
              value={universityName}
              onChange={(e) => setUniversityName(e.target.value)}
              required
              className={fieldClasses}
            />
            <datalist id="university-options">
              {existingUniversities.map((u) => (
                <option key={u.id} value={u.name} />
              ))}
            </datalist>
          </Field>

          <Field label={t("countryLabel")}>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={Boolean(matchedUniversity)}
              className={`${fieldClasses} disabled:opacity-60`}
            >
              <option value="">{t("countryPlaceholder")}</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("programLabel")}>
            <input
              type="text"
              list="program-options"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              required
              className={fieldClasses}
            />
            <datalist id="program-options">
              {programsForUniversity.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </Field>

          <Field label={t("degreeLabel")}>
            <select
              value={degreeType}
              onChange={(e) => setDegreeType(e.target.value)}
              className={fieldClasses}
            >
              {DEGREE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {degreeOptions(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("fieldLabel")}>
            <input
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              className={fieldClasses}
            />
          </Field>

          <Field label={t("intakeYearLabel")}>
            <select
              value={intakeYear}
              onChange={(e) => setIntakeYear(e.target.value)}
              className={fieldClasses}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("intakeSeasonLabel")}>
            <select
              value={intakeSeason}
              onChange={(e) => setIntakeSeason(e.target.value as IntakeSeason)}
              className={fieldClasses}
            >
              {INTAKE_SEASONS.map((season) => (
                <option key={season} value={season}>
                  {intakeSeasonOptions(season)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("deadlineLabel")}>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={fieldClasses}
            />
          </Field>

          <Field label={t("deadlineTimezoneLabel")}>
            <input
              type="text"
              list="timezone-options"
              value={deadlineTimezone}
              onChange={(e) => setDeadlineTimezone(e.target.value)}
              className={fieldClasses}
            />
            <datalist id="timezone-options">
              {COMMON_TIMEZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </Field>

          <p className="text-xs text-zinc-400 sm:col-span-2">{t("deadlineDisclaimer")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-zinc-900">{t("suggestedTasksHeading")}</h2>
          <p className="text-sm text-zinc-500">{t("suggestedTasksHint")}</p>
        </div>
        <ul className="flex flex-col divide-y divide-zinc-100">
          {CHECKLIST_TEMPLATE.map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-2.5">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={checkedTasks.has(item.key)}
                  onChange={() => toggleTask(item.key)}
                  className="h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
                <span className="text-sm text-zinc-800">{checklistT(item.key)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("saving") : t("submit")}
        </button>
      </div>
    </form>
  );
}
