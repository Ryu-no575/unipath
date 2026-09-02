"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { emptyProfileFormValues, type ProfileFormValues } from "@/app/lib/profile-types";
import { getCountryOptions } from "@/app/lib/countries";
import { flagEmoji } from "@/app/lib/countryFlag";
import { encodeGuestMatchQuery } from "@/app/lib/match/guestQuery";
import { writeGuestProfileToSession } from "@/app/lib/match/guestSession";
import {
  BudgetSection,
  DestinationSection,
  StudyGoalSection,
  type ProfileFieldPatch,
} from "@/app/components/profile/ProfileFieldSections";
import GuestQuizReviewStep from "./GuestQuizReviewStep";
import QuizShell from "./QuizShell";

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

  const countryOptions = getCountryOptions(locale);
  const destinationLabels = values.destinationCountries
    .map((code) => countryOptions.find((c) => c.code === code))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .slice(0, 3)
    .map((c) => `${flagEmoji(c.code)} ${c.label}`);
  const narrowingPath: string[] = [];
  if (step >= 1 && values.fieldOfStudy) narrowingPath.push(values.fieldOfStudy);
  if (step >= 2 && destinationLabels.length > 0) narrowingPath.push(...destinationLabels);

  return (
    <QuizShell
      heading={t("quizHeading")}
      tagline={t("quizTagline")}
      timeEstimate={t("timeEstimate")}
      stepLabel={t("stepLabel", { current: step + 1, total: STEPS.length })}
      stepTitle={t(STEPS[step])}
      stepIndex={step}
      totalSteps={STEPS.length}
      narrowingPath={narrowingPath}
      backLabel={t("back")}
      nextLabel={isLastStep ? t("submit") : t("next")}
      onBack={goBack}
      onNext={goNext}
      backDisabled={step === 0}
    >
      {step === 0 && <StudyGoalSection values={values} onChange={handleChange} />}
      {step === 1 && <DestinationSection values={values} onChange={handleChange} />}
      {step === 2 && <BudgetSection values={values} onChange={handleChange} />}
      {step === 3 && <GuestQuizReviewStep values={values} locale={locale} />}
    </QuizShell>
  );
}
