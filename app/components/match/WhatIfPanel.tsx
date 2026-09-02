"use client";

import { useTranslations } from "next-intl";
import { getCountryOptions } from "@/app/lib/countries";
import { scoreRealCandidate } from "@/app/lib/match/real-engine";
import type { MatchProfileInputs } from "@/app/lib/match/types";
import type { RealProgramCandidate } from "@/app/lib/match/real-types";
import type { CountryCode } from "@/app/lib/countries";

/**
 * "What would improve this match" -- re-runs the exact same scoring function
 * the results page used (scoreRealCandidate) against a hypothetically
 * changed profile, for this one candidate only. Only ever shows a lever the
 * real engine actually scores on (budget, destination country); never a
 * hardcoded claim, and silently renders nothing if no lever applies (e.g.
 * the candidate is already a perfect fit, or the user never set a budget).
 */
export default function WhatIfPanel({
  candidate,
  profile,
  destinationCountries,
  scorePercent,
  locale,
}: {
  candidate: RealProgramCandidate;
  profile: MatchProfileInputs;
  destinationCountries: CountryCode[];
  scorePercent: number;
  locale: string;
}) {
  const t = useTranslations("MatchResults");

  const scenarios: { key: string; label: string; delta: number; nextPercent: number }[] = [];

  if (profile.maxTuition != null) {
    const increasedBudget = { ...profile, maxTuition: Math.round(profile.maxTuition * 1.2) };
    const rescored = scoreRealCandidate(candidate, increasedBudget, destinationCountries);
    if (rescored.scorePercent > scorePercent) {
      scenarios.push({
        key: "budget",
        label: t("whatIfBudget"),
        delta: rescored.scorePercent - scorePercent,
        nextPercent: rescored.scorePercent,
      });
    }
  }

  if (candidate.countryCode && !destinationCountries.includes(candidate.countryCode)) {
    const expandedCountries = [...destinationCountries, candidate.countryCode];
    const rescored = scoreRealCandidate(candidate, profile, expandedCountries);
    if (rescored.scorePercent > scorePercent) {
      const countryLabel =
        getCountryOptions(locale).find((c) => c.code === candidate.countryCode)?.label ?? candidate.countryCode;
      scenarios.push({
        key: "country",
        label: t("whatIfCountry", { country: countryLabel }),
        delta: rescored.scorePercent - scorePercent,
        nextPercent: rescored.scorePercent,
      });
    }
  }

  if (scenarios.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/15 bg-primary/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("whatIfHeading")}</p>
      <ul className="flex flex-col gap-1.5">
        {scenarios.map((scenario) => (
          <li key={scenario.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">{scenario.label}</span>
            <span className="shrink-0 font-semibold text-primary">
              {scenario.nextPercent}%{" "}
              <span className="font-normal text-primary/70">(+{scenario.delta})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
