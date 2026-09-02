"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getCountryOptions, type CountryCode } from "@/app/lib/countries";
import type { RealMatchReason, RealMatchResult } from "@/app/lib/match/real-types";
import type { MatchProfileInputs, MatchTier } from "@/app/lib/match/types";
import CountUpPercent from "./CountUpPercent";
import WhatIfPanel from "./WhatIfPanel";

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

function reasonKey(kind: RealMatchReason["kind"]): string {
  switch (kind) {
    case "field_positive":
      return "realWhyFieldPositive";
    case "field_caution":
      return "realWhyFieldCaution";
    case "degree_match":
      return "realWhyDegreeMatch";
    case "location_within":
      return "realWhyLocationWithin";
    case "location_outside":
      return "realWhyLocationOutside";
    case "budget_within":
      return "realWhyBudgetWithin";
    case "budget_over":
      return "realWhyBudgetOver";
    case "budget_unknown":
      return "realWhyBudgetUnknown";
    default:
      return "";
  }
}

export default function RealMatchCard({
  result,
  locale,
  guest = false,
  variant = "default",
  profile,
  destinationCountries,
}: {
  result: RealMatchResult;
  locale: string;
  /** True on the guest Match Results page (task brief section 3) -- hides
   * the "View Route" link, since /routes needs an account profile it can't
   * compute anything from yet. Guests get a Route Preview via the page-level
   * "See Route Preview" CTA instead (see explore/match/results/page.tsx). */
  guest?: boolean;
  /** "hero" is used once, for the #1 result: bigger score, reasons shown
   * without a toggle, and (when profile/destinationCountries are passed) a
   * "What would improve this match" panel. */
  variant?: "default" | "hero";
  profile?: MatchProfileInputs;
  destinationCountries?: CountryCode[];
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("MatchResults");
  const liveData = useTranslations("LiveData");
  const fields = useTranslations("Fields");
  const applicationTypeLabels = useTranslations("ApplicationTypeOptions");
  const format = useFormatter();
  const { candidate, scorePercent, tier, reasons } = result;
  const isHero = variant === "hero";

  const countryLabel = candidate.countryCode
    ? (getCountryOptions(locale).find((c) => c.code === candidate.countryCode)?.label ?? candidate.countryCode)
    : null;
  const location = [candidate.city, countryLabel].filter(Boolean).join(", ");

  return (
    <div
      className={
        isHero
          ? "flex flex-col gap-4 rounded-2xl border-2 border-gold/50 bg-white p-6 shadow-elevated sm:p-8"
          : "flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5"
      }
    >
      {isHero && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1 text-[11px] font-semibold tracking-wide text-gold-soft uppercase">
          {t("topMatchLabel")}
        </span>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/universities/${candidate.universityId}`}
              className={
                isHero
                  ? "text-xl font-semibold text-navy-900 underline-offset-2 hover:underline sm:text-2xl"
                  : "text-base font-semibold text-zinc-900 underline-offset-2 hover:underline"
              }
            >
              {candidate.universityName}
            </Link>
            {candidate.verified && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {t("verifiedBadge")}
              </span>
            )}
          </div>
          <p className={isHero ? "text-sm text-zinc-600" : "text-sm text-zinc-500"}>
            {candidate.programName}
            {location ? ` · ${location}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isHero ? (
            <CountUpPercent value={scorePercent} className="text-4xl font-bold text-primary sm:text-5xl" />
          ) : (
            <span className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${TIER_BADGE_CLASSES[tier]}`}>
              {t("matchLabel", { percent: scorePercent })}
            </span>
          )}
          <span className="text-xs font-medium text-zinc-500">{t(TIER_LABEL_KEYS[tier])}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
        {candidate.degreeType && (
          <span className="rounded-full border border-zinc-200 px-2.5 py-1">
            {applicationTypeLabels(candidate.degreeType)}
          </span>
        )}
        {candidate.language && <span className="rounded-full border border-zinc-200 px-2.5 py-1">{candidate.language}</span>}
        {candidate.duration && <span className="rounded-full border border-zinc-200 px-2.5 py-1">{candidate.duration}</span>}
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400">{t("tuitionValueLabel")}</span>
          <span className="font-medium text-zinc-900">
            {candidate.tuitionAmount != null
              ? `${candidate.tuitionAmount.toLocaleString(locale)} ${candidate.tuitionCurrency ?? ""}`.trim()
              : t("realTuitionUnknown")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400">{fields("applicationDeadline")}</span>
          <span className="font-medium text-zinc-900">
            {candidate.applicationDeadline
              ? format.dateTime(new Date(candidate.applicationDeadline), "long")
              : t("realDeadlineUnknown")}
          </span>
        </div>
      </div>

      {isHero ? (
        <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("whyButton", { percent: scorePercent })}</p>
          {reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={reason.marker === "positive" ? "text-emerald-600" : "text-amber-600"} aria-hidden>
                {reason.marker === "positive" ? "✓" : "△"}
              </span>
              <span className="text-zinc-700">{t(reasonKey(reason.kind) as "realWhyFieldPositive")}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start border-t border-zinc-100 pt-4 text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
          >
            {expanded ? t("hideButton") : t("whyButton", { percent: scorePercent })}
          </button>

          {expanded && (
            <div className="flex flex-col gap-1.5">
              {reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={reason.marker === "positive" ? "text-emerald-600" : "text-amber-600"} aria-hidden>
                    {reason.marker === "positive" ? "✓" : "△"}
                  </span>
                  <span className="text-zinc-700">{t(reasonKey(reason.kind) as "realWhyFieldPositive")}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isHero && profile && destinationCountries && (
        <WhatIfPanel
          candidate={candidate}
          profile={profile}
          destinationCountries={destinationCountries}
          scorePercent={scorePercent}
          locale={locale}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span>
            {candidate.lastCheckedAt
              ? liveData("lastCheckedAt", { time: format.relativeTime(new Date(candidate.lastCheckedAt)) })
              : liveData("notYetChecked")}
          </span>
          <Link
            href={`/universities/${candidate.universityId}/community`}
            className="font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
          >
            {t("communityLink")}
          </Link>
          {!guest && (
            <Link
              href={`/routes?university=${candidate.universityId}&program=${candidate.programId}`}
              className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
            >
              {t("viewRoute")}
            </Link>
          )}
        </div>
        {candidate.officialUrlStatus === "unavailable" ? (
          <span className="text-amber-600">{liveData("sourceBeingReVerified")}</span>
        ) : (
          candidate.officialUrl && (
            <a
              href={candidate.officialUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
            >
              {liveData("officialSource")} →
            </a>
          )
        )}
      </div>
    </div>
  );
}
