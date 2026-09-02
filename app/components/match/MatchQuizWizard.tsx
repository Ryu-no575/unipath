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
import QuizShell from "./QuizShell";
import { flagEmoji } from "@/app/lib/countryFlag";

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

  const destinationLabels = profileSummary.destinationCountries
    .slice(0, 3)
    .map((c) => `${flagEmoji(c.code)} ${c.label}`);
  const narrowingPath = [
    ...destinationLabels,
    ...(profileSummary.fieldOfStudy ? [profileSummary.fieldOfStudy] : []),
  ];

  return (
    <QuizShell
      heading={t("heading")}
      tagline={t("tagline")}
      timeEstimate={t("timeEstimate")}
      stepLabel={t("stepLabel", { current: step + 1, total: STEPS.length })}
      stepTitle={t(STEPS[step])}
      stepIndex={step}
      totalSteps={STEPS.length}
      narrowingPath={narrowingPath}
      backLabel={t("back")}
      nextLabel={isPending ? t("submitting") : isLastStep ? t("submit") : t("next")}
      onBack={goBack}
      onNext={goNext}
      backDisabled={step === 0 || isPending}
      nextDisabled={isPending}
    >
      {step === 0 && <ProfileSummaryStep summary={profileSummary} />}
      {step === 1 && <EnvironmentStep values={values} onChange={handleChange} />}
      {step === 2 && <ClassSizeStep values={values} onChange={handleChange} />}
      {step === 3 && <ClimateStep values={values} onChange={handleChange} />}
      {step === 4 && <WorkImportanceStep values={values} onChange={handleChange} />}
      {step === 5 && <ScholarshipStep values={values} onChange={handleChange} />}
      {step === 6 && <ReviewStep values={values} />}
    </QuizShell>
  );
}
