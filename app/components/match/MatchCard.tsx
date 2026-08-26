"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRIORITY_LABEL_KEYS } from "@/app/lib/profile-types";
import { getCountryOptions } from "@/app/lib/countries";
import {
  CLASS_SIZE_LABEL_KEYS,
  CLIMATE_LABEL_KEYS,
  ENVIRONMENT_LABEL_KEYS,
  type MatchReason,
  type MatchResult,
  type MatchTier,
} from "@/app/lib/match/types";

const TIER_BADGE_CLASSES: Record<MatchTier, string> = {
  strong: "bg-emerald-600",
  good: "bg-teal-600",
  possible: "bg-amber-600",
  closest: "bg-zinc-500",
};

const TIER_LABEL_KEYS = {
  strong: "tierStrong",
  good: "tierGood",
  possible: "tierPossible",
  closest: "tierClosest",
} as const satisfies Record<MatchTier, string>;

type TFn = ReturnType<typeof useTranslations<"MatchResults">>;
type PriorityTFn = ReturnType<typeof useTranslations<"PriorityOptions">>;

function reasonText(reason: MatchReason, t: TFn, priorityLabels: PriorityTFn, fieldLabel: string): string {
  switch (reason.kind) {
    case "field_positive":
      return t("whyGenericPositive", { label: fieldLabel });
    case "field_caution":
      return t("whyGenericCaution", { label: fieldLabel });
    case "degree_match":
      return t("whyDegreeMatch");
    case "english_met":
      return t("whyEnglishMet");
    case "english_gap":
      return t("whyEnglishGap", { required: reason.params?.required ?? 0, yours: reason.params?.yours ?? 0 });
    case "location_within":
      return t("whyLocationWithin");
    case "location_outside":
      return t("whyLocationOutside");
    case "budget_within":
    case "budget_slightly_over":
    case "budget_well_over": {
      const label = priorityLabels(PRIORITY_LABEL_KEYS[reason.priorityType!]);
      const key =
        reason.kind === "budget_within"
          ? "whyBudgetWithin"
          : reason.kind === "budget_slightly_over"
            ? "whyBudgetSlightlyOver"
            : "whyBudgetWellOver";
      return t(key, { label });
    }
    case "generic_positive":
    case "generic_caution": {
      const label = priorityLabels(PRIORITY_LABEL_KEYS[reason.priorityType!]);
      return t(reason.kind === "generic_positive" ? "whyGenericPositive" : "whyGenericCaution", { label });
    }
    default:
      return "";
  }
}

export default function MatchCard({ result }: { result: MatchResult }) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("MatchResults");
  const options = useTranslations("MatchOptions");
  const priorityLabels = useTranslations("PriorityOptions");
  const applicationTypeLabels = useTranslations("ApplicationTypeOptions");
  const locale = useLocale();
  const { candidate, scorePercent, tier, reasons } = result;

  const countryLabel =
    getCountryOptions(locale).find((c) => c.code === candidate.countryCode)?.label ??
    candidate.countryCode;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-zinc-900">{candidate.universityName}</h3>
          <p className="text-sm text-zinc-500">
            {candidate.programName} &middot; {candidate.city}, {countryLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${TIER_BADGE_CLASSES[tier]}`}
          >
            {t("matchLabel", { percent: scorePercent })}
          </span>
          <span className="text-xs font-medium text-zinc-500">{t(TIER_LABEL_KEYS[tier])}</span>
        </div>
      </div>

      {tier === "closest" && (
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">{t("closestMatchNote")}</p>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
        <span className="rounded-full border border-zinc-200 px-2.5 py-1">
          {applicationTypeLabels(candidate.degreeType)}
        </span>
        <span className="rounded-full border border-zinc-200 px-2.5 py-1">
          {options(ENVIRONMENT_LABEL_KEYS[candidate.environment])}
        </span>
        <span className="rounded-full border border-zinc-200 px-2.5 py-1">
          {options(CLASS_SIZE_LABEL_KEYS[candidate.studentBodySize])}
        </span>
        <span className="rounded-full border border-zinc-200 px-2.5 py-1">
          {options(CLIMATE_LABEL_KEYS[candidate.climate])}
        </span>
        {candidate.scholarshipsAvailable && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
            {t("scholarshipsAvailable")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400">{t("tuitionValueLabel")}</span>
          <span className="font-medium text-zinc-900">
            {candidate.tuitionAmount.toLocaleString(locale)} {candidate.tuitionCurrency}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400">{t("livingCostValueLabel")}</span>
          <span className="font-medium text-zinc-900">
            {candidate.livingCostAmount.toLocaleString(locale)} {candidate.livingCostCurrency}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="self-start text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
      >
        {expanded ? t("hideButton") : t("whyButton", { percent: scorePercent })}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-4">
          {reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span
                className={reason.marker === "positive" ? "text-emerald-600" : "text-amber-600"}
                aria-hidden
              >
                {reason.marker === "positive" ? "✓" : "△"}
              </span>
              <span className="text-zinc-700">
                {reasonText(reason, t, priorityLabels, t("fieldOfStudyFactor"))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
