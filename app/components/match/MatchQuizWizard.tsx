"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { ApplicationType, PriorityType } from "@/app/lib/supabase/database.types";
import { defaultMatchQuizAnswers, type MatchQuizAnswers } from "@/app/lib/match/types";
import { submitMatchQuizAction } from "@/app/lib/actions/match";
import {
  ClassSizeStep,
  ClimateStep,
  EnvironmentStep,
  ProfileSummaryStep,
  ReviewStep,
  ScholarshipStep,
  WorkImportanceStep,
  type MatchQuizPatch,
} from "./MatchQuizSections";

export interface ProfileSummary {
  destinationCountries: { code: string; label: string }[];
  fieldOfStudy: string | null;
  applicationType: ApplicationType | null;
  maxTuition: string | null;
  tuitionCurrency: string | null;
  priorities: Record<PriorityType, number>;
}

const STEPS = [
  "step1Title",
  "step2Title",
  "step3Title",
  "step4Title",
  "step5Title",
  "step6Title",
  "step7Title",
] as const;

export default function MatchQuizWizard({
  locale,
  profileSummary,
}: {
  locale: AppLocale;
  profileSummary: ProfileSummary;
}) {
  const t = useTranslations("MatchQuiz");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<MatchQuizAnswers>(defaultMatchQuizAnswers());
  const [isPending, startTransition] = useTransition();

  function handleChange(patch: MatchQuizPatch) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Redirects on completion (see submitMatchQuizAction) -- nothing to
    // handle here on success, and it has no failure path to report.
    startTransition(() => submitMatchQuizAction(locale, values));
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("tagline")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
          <span>{t("stepLabel", { current: step + 1, total: STEPS.length })}</span>
          <span>{t(STEPS[step])}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-100">
          <div
            className="h-1.5 rounded-full bg-zinc-900 transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        {step === 0 && <ProfileSummaryStep summary={profileSummary} />}
        {step === 1 && <EnvironmentStep values={values} onChange={handleChange} />}
        {step === 2 && <ClassSizeStep values={values} onChange={handleChange} />}
        {step === 3 && <ClimateStep values={values} onChange={handleChange} />}
        {step === 4 && <WorkImportanceStep values={values} onChange={handleChange} />}
        {step === 5 && <ScholarshipStep values={values} onChange={handleChange} />}
        {step === 6 && <ReviewStep values={values} />}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || isPending}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-0"
        >
          {t("back")}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("submitting") : isLastStep ? t("submit") : t("next")}
        </button>
      </div>
    </div>
  );
}
