"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { ProfileFormValues } from "@/app/lib/profile-types";
import { completeOnboardingAction } from "@/app/lib/actions/profile";
import {
  AcademicSection,
  BudgetSection,
  DestinationSection,
  PersonalSection,
  PrioritiesSection,
  StudyGoalSection,
  type ProfileFieldPatch,
} from "./ProfileFieldSections";

const STEPS = [
  "step1Title",
  "step2Title",
  "step3Title",
  "step4Title",
  "step5Title",
  "step6Title",
] as const;

export default function OnboardingWizard({
  locale,
  initialValues,
}: {
  locale: AppLocale;
  initialValues: ProfileFormValues;
}) {
  const t = useTranslations("Onboarding");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(patch: ProfileFieldPatch) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    setError(null);
    startTransition(async () => {
      // On success this redirects and never resolves back into this
      // component. On failure it resolves with an error — stay on this
      // step with `values` intact rather than bouncing back to onboarding's
      // first step, so the user doesn't lose their input.
      const result = await completeOnboardingAction(locale, values);
      if (result?.error) setError(result.error);
    });
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {t("welcome")}
        </h1>
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
        {step === 0 && <PersonalSection values={values} onChange={handleChange} />}
        {step === 1 && <StudyGoalSection values={values} onChange={handleChange} />}
        {step === 2 && <DestinationSection values={values} onChange={handleChange} />}
        {step === 3 && <AcademicSection values={values} onChange={handleChange} />}
        {step === 4 && <BudgetSection values={values} onChange={handleChange} />}
        {step === 5 && <PrioritiesSection values={values} onChange={handleChange} />}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {t("saveError")} {error}
        </p>
      )}

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
          {isPending ? t("saving") : isLastStep ? t("submit") : t("next")}
        </button>
      </div>
    </div>
  );
}
