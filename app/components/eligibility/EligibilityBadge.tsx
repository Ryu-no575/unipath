import { useTranslations } from "next-intl";
import type { ProgramEligibilityTier } from "@/app/lib/eligibility/types";

const STYLES: Record<ProgramEligibilityTier, string> = {
  eligible_now: "bg-emerald-50 text-emerald-700",
  almost_eligible: "bg-amber-50 text-amber-700",
  not_currently_eligible: "bg-red-50 text-red-700",
  unknown: "bg-zinc-100 text-zinc-500",
};

/** Task item 4: ELIGIBLE_NOW / ALMOST_ELIGIBLE / NOT_CURRENTLY_ELIGIBLE /
 * UNKNOWN -- deliberately its own badge (not the generic `Status` component)
 * since this vocabulary is specific to admission-requirement eligibility and
 * must never be confused with MatchStatus (preference fit) or the generic
 * ready/missing Status kinds. */
export default function EligibilityBadge({ tier }: { tier: ProgramEligibilityTier }) {
  const t = useTranslations("EligibilityOptions");

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[tier]}`}>
      {t(tier)}
    </span>
  );
}
