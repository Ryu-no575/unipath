"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getCountryOptions } from "@/app/lib/countries";
import { CURRENCIES } from "@/app/lib/currencies";
import { localeLabels, routing } from "@/i18n/routing";
import { COMMON_TIMEZONES, detectBrowserTimezone } from "@/app/lib/timezone";
import {
  APPLICATION_TYPES,
  ENGLISH_TEST_TYPES,
  INTAKE_SEASONS,
  PRIORITY_LABEL_KEYS,
  PRIORITY_TYPES,
  type ProfileFormValues,
} from "@/app/lib/profile-types";
import type { PriorityType } from "@/app/lib/supabase/database.types";

const inputClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-sm font-medium text-zinc-700";

export type ProfileFieldPatch = Partial<ProfileFormValues>;

export interface SectionProps {
  values: ProfileFormValues;
  onChange: (patch: ProfileFieldPatch) => void;
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className={labelClasses}>{label}</span>
      {children}
    </label>
  );
}

export function PersonalSection({ values, onChange }: SectionProps) {
  const t = useTranslations("ProfileFields");
  const common = useTranslations("Common");
  const locale = useLocale();
  const countryOptions = getCountryOptions(locale);

  // Prefill from the browser once, the first time this profile has no
  // timezone saved yet. Never overrides a value the user already set.
  useEffect(() => {
    if (values.timezone) return;
    const detected = detectBrowserTimezone();
    if (detected) onChange({ timezone: detected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label={t("nationality")}>
        <select
          value={values.nationality}
          onChange={(e) => onChange({ nationality: e.target.value })}
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("residenceCountry")}>
        <select
          value={values.residenceCountry}
          onChange={(e) => onChange({ residenceCountry: e.target.value })}
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("preferredLanguage")}>
        <select
          value={values.preferredLocale}
          onChange={(e) => onChange({ preferredLocale: e.target.value })}
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {routing.locales.map((code) => (
            <option key={code} value={code}>
              {localeLabels[code]}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("timezone")}>
        <input
          type="text"
          list="timezone-options"
          value={values.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          placeholder="e.g. Asia/Tokyo"
          className={inputClasses}
        />
        <datalist id="timezone-options">
          {COMMON_TIMEZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}

export function StudyGoalSection({ values, onChange }: SectionProps) {
  const t = useTranslations("ProfileFields");
  const common = useTranslations("Common");
  const applicationTypeOptions = useTranslations("ApplicationTypeOptions");
  const intakeSeasonOptions = useTranslations("IntakeSeasonOptions");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear + i);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label={t("applicationType")}>
        <select
          value={values.applicationType}
          onChange={(e) =>
            onChange({ applicationType: e.target.value as ProfileFormValues["applicationType"] })
          }
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {APPLICATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {applicationTypeOptions(type)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("fieldOfStudy")}>
        <input
          type="text"
          value={values.fieldOfStudy}
          onChange={(e) => onChange({ fieldOfStudy: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("intakeYear")}>
        <select
          value={values.intakeYear}
          onChange={(e) => onChange({ intakeYear: e.target.value })}
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("intakeSeason")}>
        <select
          value={values.intakeSeason}
          onChange={(e) =>
            onChange({ intakeSeason: e.target.value as ProfileFormValues["intakeSeason"] })
          }
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {INTAKE_SEASONS.map((season) => (
            <option key={season} value={season}>
              {intakeSeasonOptions(season)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function DestinationSection({ values, onChange }: SectionProps) {
  const t = useTranslations("ProfileFields");
  const locale = useLocale();
  const countryOptions = getCountryOptions(locale);

  function toggle(code: string) {
    const set = new Set(values.destinationCountries);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    onChange({ destinationCountries: Array.from(set) });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClasses}>{t("preferredCountries")}</span>
      <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-zinc-200 p-3 sm:grid-cols-3">
        {countryOptions.map((c) => {
          const checked = values.destinationCountries.includes(c.code);
          return (
            <label
              key={c.code}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                checked ? "bg-zinc-100 text-zinc-900" : "text-zinc-600"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(c.code)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {c.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function AcademicSection({ values, onChange }: SectionProps) {
  const t = useTranslations("ProfileFields");
  const englishTestOptions = useTranslations("EnglishTestOptions");
  const common = useTranslations("Common");

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label={t("educationLevel")}>
        <input
          type="text"
          value={values.educationLevel}
          onChange={(e) => onChange({ educationLevel: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("previousInstitution")}>
        <input
          type="text"
          value={values.previousInstitution}
          onChange={(e) => onChange({ previousInstitution: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("gpaValue")}>
        <input
          type="number"
          step="0.01"
          value={values.gpaValue}
          onChange={(e) => onChange({ gpaValue: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("gpaScale")}>
        <input
          type="number"
          step="0.01"
          placeholder="4.0 / 5.0 / 100"
          value={values.gpaScale}
          onChange={(e) => onChange({ gpaScale: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("englishTestType")}>
        <select
          value={values.englishTestType}
          onChange={(e) =>
            onChange({ englishTestType: e.target.value as ProfileFormValues["englishTestType"] })
          }
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {ENGLISH_TEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {englishTestOptions(type)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("englishTestScore")}>
        <input
          type="text"
          value={values.englishTestScore}
          onChange={(e) => onChange({ englishTestScore: e.target.value })}
          className={inputClasses}
        />
      </Field>
    </div>
  );
}

export function BudgetSection({ values, onChange }: SectionProps) {
  const t = useTranslations("ProfileFields");
  const common = useTranslations("Common");

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label={t("maxTuition")}>
        <input
          type="number"
          min={0}
          value={values.maxTuition}
          onChange={(e) => onChange({ maxTuition: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("tuitionCurrency")}>
        <select
          value={values.tuitionCurrency}
          onChange={(e) => onChange({ tuitionCurrency: e.target.value })}
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol})
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("maxLivingCost")}>
        <input
          type="number"
          min={0}
          value={values.maxLivingCost}
          onChange={(e) => onChange({ maxLivingCost: e.target.value })}
          className={inputClasses}
        />
      </Field>

      <Field label={t("livingCostCurrency")}>
        <select
          value={values.livingCostCurrency}
          onChange={(e) => onChange({ livingCostCurrency: e.target.value })}
          className={inputClasses}
        >
          <option value="">{common("selectPlaceholder")}</option>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol})
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function PrioritiesSection({ values, onChange }: SectionProps) {
  const t = useTranslations("PriorityOptions");

  function setWeight(type: PriorityType, weight: number) {
    onChange({ priorities: { ...values.priorities, [type]: weight } });
  }

  return (
    <div className="flex flex-col gap-4">
      {PRIORITY_TYPES.map((type) => (
        <div key={type} className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-700">{t(PRIORITY_LABEL_KEYS[type])}</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={5}
              value={values.priorities[type] ?? 3}
              onChange={(e) => setWeight(type, Number(e.target.value))}
              className="w-32 accent-zinc-900"
            />
            <span className="w-4 text-center text-sm font-medium text-zinc-900">
              {values.priorities[type] ?? 3}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
