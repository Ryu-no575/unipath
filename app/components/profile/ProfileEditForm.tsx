"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { ProfileFormValues } from "@/app/lib/profile-types";
import { updateProfileAction } from "@/app/lib/actions/profile";
import {
  AcademicSection,
  BudgetSection,
  DestinationSection,
  PersonalSection,
  PrioritiesSection,
  StudyGoalSection,
  type ProfileFieldPatch,
} from "./ProfileFieldSections";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export type ProfileSectionKey =
  | "personal"
  | "studyGoal"
  | "destination"
  | "academic"
  | "budget"
  | "priorities";

const ALL_SECTIONS: ProfileSectionKey[] = [
  "personal",
  "studyGoal",
  "destination",
  "academic",
  "budget",
  "priorities",
];

export default function ProfileEditForm({
  locale,
  initialValues,
  sections = ALL_SECTIONS,
}: {
  locale: AppLocale;
  initialValues: ProfileFormValues;
  /** Which section blocks to render on this page -- the underlying form
   * state always holds the full profile so saving from any subset never
   * drops the other tabs' values (AGENTS.md: Profile is split into tabs,
   * not into separate save actions). */
  sections?: ProfileSectionKey[];
}) {
  const t = useTranslations("Onboarding");
  const profileT = useTranslations("Profile");
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(patch: ProfileFieldPatch) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileAction(locale, values);
      if (result?.error) setError(result.error);
    });
  }

  const show = (key: ProfileSectionKey) => sections.includes(key);

  return (
    <div className="flex flex-col gap-6">
      {show("personal") && (
        <Section title={t("step1Title")}>
          <PersonalSection values={values} onChange={handleChange} />
        </Section>
      )}
      {show("studyGoal") && (
        <Section title={t("step2Title")}>
          <StudyGoalSection values={values} onChange={handleChange} />
        </Section>
      )}
      {show("destination") && (
        <Section title={t("step3Title")}>
          <DestinationSection values={values} onChange={handleChange} />
        </Section>
      )}
      {show("academic") && (
        <Section title={t("step4Title")}>
          <AcademicSection values={values} onChange={handleChange} />
        </Section>
      )}
      {show("budget") && (
        <Section title={t("step5Title")}>
          <BudgetSection values={values} onChange={handleChange} />
        </Section>
      )}
      {show("priorities") && (
        <Section title={t("step6Title")}>
          <PrioritiesSection values={values} onChange={handleChange} />
        </Section>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {t("saveError")} {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("saving") : profileT("save")}
        </button>
      </div>
    </div>
  );
}
