"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { emptyProfileFormValues, type ProfileFormValues } from "@/app/lib/profile-types";
import { encodeGuestMatchQuery } from "@/app/lib/match/guestQuery";
import { writeGuestProfileToSession } from "@/app/lib/match/guestSession";
import {
  BudgetSection,
  DestinationSection,
  StudyGoalSection,
  type ProfileFieldPatch,
} from "@/app/components/profile/ProfileFieldSections";
import GuestQuizReviewStep from "./GuestQuizReviewStep";

const STEPS = ["step1Title", "step2Title", "step3Title", "step4Title"] as const;

/**
 * The guest-facing Match Quiz (task brief section 3: "簡易質問"). Reuses the
 * same StudyGoal/Destination/Budget sections onboarding uses -- they already
 * collect exactly the fields the real match engine reads (see
 * app/lib/match/real-engine.ts) plus the extras (intake year/season) that
 * make the onboarding prefill richer once this guest signs up (see
 * app/lib/match/guestSession.ts). Never touches Supabase: answers travel to
 * Results via URL params (guestQuery.ts) and to a future signup via
 * sessionStorage, so a visitor can complete the whole funnel with no account
 * and nothing saved server-side.
 */
export default function GuestMatchQuizWizard({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ProfileFormValues>(emptyProfileFormValues());

  function handleChange(patch: ProfileFieldPatch) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    writeGuestProfileToSession(values);
    router.push(`/explore/match/results?${encodeGuestMatchQuery(values)}`);
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("quizHeading")}</h1>
        <p className="text-sm text-zinc-500">{t("quizTagline")}</p>
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
        {step === 0 && <StudyGoalSection values={values} onChange={handleChange} />}
        {step === 1 && <DestinationSection values={values} onChange={handleChange} />}
        {step === 2 && <BudgetSection values={values} onChange={handleChange} />}
        {step === 3 && <GuestQuizReviewStep values={values} locale={locale} />}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-0"
        >
          {t("back")}
        </button>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {isLastStep ? t("submit") : t("next")}
        </button>
      </div>
    </div>
  );
}
