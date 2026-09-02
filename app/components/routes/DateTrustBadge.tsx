import { useTranslations } from "next-intl";
import type { DateConfidence } from "@/app/lib/routes/types";

/** Date Engine v2's trust indicator (task brief PART B item 16/20) -- every
 * date on a Route must let the user tell at a glance whether it's a
 * university/government fact, a UniPath recommendation, a rough estimate, or
 * simply not known yet. Symbol + short glossary line, always both (never
 * symbol-only): first-time users don't know what "✓" means without it. */
const CONFIDENCE_SYMBOL: Record<DateConfidence, string> = {
  official: "✓",
  suggested: "●",
  estimated_window: "○",
  unverified: "?",
};

const CONFIDENCE_CLASSES: Record<DateConfidence, string> = {
  official: "bg-emerald-50 text-emerald-700",
  suggested: "bg-blue-50 text-blue-700",
  estimated_window: "bg-amber-50 text-amber-700",
  unverified: "bg-zinc-100 text-zinc-500",
};

export default function DateTrustBadge({ confidence }: { confidence: DateConfidence }) {
  const t = useTranslations("Routes");
  const label = t(`dateConfidenceLabel_${confidence}`);
  const explainer = t(`dateConfidenceExplainer_${confidence}`);

  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_CLASSES[confidence]}`}
      title={explainer}
    >
      <span aria-hidden>{CONFIDENCE_SYMBOL[confidence]}</span>
      {label}
    </span>
  );
}
