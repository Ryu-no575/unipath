"use client";

import { useTranslations } from "next-intl";
import { PRIORITY_LABEL_KEYS } from "@/app/lib/profile-types";
import {
  CAMPUS_ENVIRONMENTS,
  CLASS_SIZE_LABEL_KEYS,
  CLASS_SIZE_PREFERENCES,
  CLIMATE_LABEL_KEYS,
  CLIMATE_PREFERENCES,
  ENVIRONMENT_LABEL_KEYS,
  type MatchQuizAnswers,
} from "@/app/lib/match/types";
import { Link } from "@/i18n/navigation";
import type { ProfileSummary } from "./MatchQuizWizard";

export type MatchQuizPatch = Partial<MatchQuizAnswers>;

export interface QuizSectionProps {
  values: MatchQuizAnswers;
  onChange: (patch: MatchQuizPatch) => void;
}

const optionCardClasses = (active: boolean) =>
  `flex min-h-14 flex-1 flex-col items-start justify-center gap-1 rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
    active
      ? "border-primary bg-primary text-white shadow-soft"
      : "border-zinc-200 text-zinc-700 hover:border-primary/40 hover:bg-primary/5"
  }`;

export function ProfileSummaryStep({ summary }: { summary: ProfileSummary }) {
  const t = useTranslations("MatchQuiz");
  const priorityLabels = useTranslations("PriorityOptions");
  const applicationTypeLabels = useTranslations("ApplicationTypeOptions");

  const missing: string[] = [];
  if (summary.destinationCountries.length === 0) missing.push(t("summaryDestinations"));
  if (!summary.fieldOfStudy) missing.push(t("summaryFieldOfStudy"));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-zinc-900">{t("profileSummaryTitle")}</h3>
        <p className="text-sm text-zinc-500">
          {t.rich("profileSummaryHint", {
            editProfileLink: (chunks) => (
              <Link href="/profile" className="font-medium text-zinc-900 underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("summaryDestinations")}
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {summary.destinationCountries.length > 0
              ? summary.destinationCountries.map((c) => c.label).join(", ")
              : t("summaryDestinationsEmpty")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("summaryFieldOfStudy")}
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {summary.fieldOfStudy || t("summaryFieldOfStudyEmpty")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("summaryDegree")}
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {summary.applicationType
              ? applicationTypeLabels(summary.applicationType)
              : t("summaryDegreeEmpty")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("summaryBudget")}
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {summary.maxTuition
              ? `${summary.maxTuition} ${summary.tuitionCurrency ?? ""}`.trim()
              : t("summaryBudgetEmpty")}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("summaryPriorities")}
          </dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {Object.entries(summary.priorities).map(([type, weight]) => (
              <span
                key={type}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
              >
                {priorityLabels(PRIORITY_LABEL_KEYS[type as keyof typeof PRIORITY_LABEL_KEYS])}{" "}
                &middot; {weight}/5
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {missing.length > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("profileMissingWarning")} {missing.join(", ")}
        </p>
      )}
    </div>
  );
}

export function EnvironmentStep({ values, onChange }: QuizSectionProps) {
  const t = useTranslations("MatchQuiz");
  const options = useTranslations("MatchOptions");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-zinc-700">{t("environmentQuestion")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {CAMPUS_ENVIRONMENTS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange({ campusEnvironment: option })}
            className={optionCardClasses(values.campusEnvironment === option)}
          >
            {options(ENVIRONMENT_LABEL_KEYS[option])}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ClassSizeStep({ values, onChange }: QuizSectionProps) {
  const t = useTranslations("MatchQuiz");
  const options = useTranslations("MatchOptions");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-zinc-700">{t("sizeQuestion")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {CLASS_SIZE_PREFERENCES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange({ classSizePreference: option })}
            className={optionCardClasses(values.classSizePreference === option)}
          >
            {options(CLASS_SIZE_LABEL_KEYS[option])}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ClimateStep({ values, onChange }: QuizSectionProps) {
  const t = useTranslations("MatchQuiz");
  const options = useTranslations("MatchOptions");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-zinc-700">{t("climateQuestion")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {CLIMATE_PREFERENCES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange({ climatePreference: option })}
            className={optionCardClasses(values.climatePreference === option)}
          >
            {options(CLIMATE_LABEL_KEYS[option])}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkImportanceStep({ values, onChange }: QuizSectionProps) {
  const t = useTranslations("MatchQuiz");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-zinc-700">{t("workQuestion")}</p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400">{t("workHintLow")}</span>
        <input
          type="range"
          min={1}
          max={5}
          value={values.workWhileStudyingImportance}
          onChange={(e) => onChange({ workWhileStudyingImportance: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <span className="text-xs text-zinc-400">{t("workHintHigh")}</span>
        <span className="w-4 shrink-0 text-center text-sm font-medium text-zinc-900">
          {values.workWhileStudyingImportance}
        </span>
      </div>
    </div>
  );
}

export function ScholarshipStep({ values, onChange }: QuizSectionProps) {
  const t = useTranslations("MatchQuiz");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-zinc-700">{t("scholarshipQuestion")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onChange({ scholarshipNeed: true })}
          className={optionCardClasses(values.scholarshipNeed === true)}
        >
          {t("scholarshipYes")}
        </button>
        <button
          type="button"
          onClick={() => onChange({ scholarshipNeed: false })}
          className={optionCardClasses(values.scholarshipNeed === false)}
        >
          {t("scholarshipNo")}
        </button>
      </div>
    </div>
  );
}

export function ReviewStep({ values }: { values: MatchQuizAnswers }) {
  const t = useTranslations("MatchQuiz");
  const options = useTranslations("MatchOptions");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-zinc-900">{t("reviewTitle")}</h3>
        <p className="text-sm text-zinc-500">{t("reviewHint")}</p>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm sm:grid-cols-2">
        <dt className="text-zinc-500">{t("environmentQuestion")}</dt>
        <dd className="text-zinc-900">{options(ENVIRONMENT_LABEL_KEYS[values.campusEnvironment])}</dd>
        <dt className="text-zinc-500">{t("sizeQuestion")}</dt>
        <dd className="text-zinc-900">{options(CLASS_SIZE_LABEL_KEYS[values.classSizePreference])}</dd>
        <dt className="text-zinc-500">{t("climateQuestion")}</dt>
        <dd className="text-zinc-900">{options(CLIMATE_LABEL_KEYS[values.climatePreference])}</dd>
        <dt className="text-zinc-500">{t("workQuestion")}</dt>
        <dd className="text-zinc-900">{values.workWhileStudyingImportance}/5</dd>
        <dt className="text-zinc-500">{t("scholarshipQuestion")}</dt>
        <dd className="text-zinc-900">
          {values.scholarshipNeed ? t("scholarshipYes") : t("scholarshipNo")}
        </dd>
      </dl>
    </div>
  );
}
