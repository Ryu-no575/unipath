"use client";

import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { getCountryOptions } from "@/app/lib/countries";
import type { ProfileFormValues } from "@/app/lib/profile-types";

export default function GuestQuizReviewStep({
  values,
  locale,
}: {
  values: ProfileFormValues;
  locale: AppLocale;
}) {
  const t = useTranslations("Guest");
  const fields = useTranslations("ProfileFields");
  const applicationTypeLabels = useTranslations("ApplicationTypeOptions");
  const countryLabels = new Map<string, string>(getCountryOptions(locale).map((c) => [c.code, c.label]));

  const destinationsLabel = values.destinationCountries.length
    ? values.destinationCountries.map((code) => countryLabels.get(code) ?? code).join(", ")
    : "—";
  const budgetLabel = values.maxTuition
    ? `${values.maxTuition} ${values.tuitionCurrency}`.trim()
    : "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-zinc-900">{t("reviewTitle")}</h3>
        <p className="text-sm text-zinc-500">{t("reviewHint")}</p>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm sm:grid-cols-2">
        <dt className="text-zinc-500">{fields("applicationType")}</dt>
        <dd className="text-zinc-900">
          {values.applicationType ? applicationTypeLabels(values.applicationType) : "—"}
        </dd>
        <dt className="text-zinc-500">{fields("fieldOfStudy")}</dt>
        <dd className="text-zinc-900">{values.fieldOfStudy || "—"}</dd>
        <dt className="text-zinc-500">{fields("preferredCountries")}</dt>
        <dd className="text-zinc-900">{destinationsLabel}</dd>
        <dt className="text-zinc-500">{fields("maxTuition")}</dt>
        <dd className="text-zinc-900">{budgetLabel}</dd>
      </dl>
    </div>
  );
}
