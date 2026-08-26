import { useFormatter, useTranslations } from "next-intl";
import type { VerifiedField } from "@/app/lib/data/sources";
import { fieldLabel } from "@/app/lib/live-data/field-labels";

const CONFIDENCE_CLASSES: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

/**
 * Per-field values the live-data pipeline has actually extracted from an
 * official source -- distinct from the curated admission_cycles/programs
 * columns, which only change through manual review (see
 * app/lib/live-data/checkSource.ts). Every value here always shows its
 * source link, retrieval time, and confidence -- never asserted as fact
 * without a way to check it (see AGENTS.md task notes on Verification).
 */
export default function VerifiedFields({ fields }: { fields: VerifiedField[] }) {
  const t = useTranslations("LiveData");
  const format = useFormatter();

  if (fields.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{t("verifiedFieldsHeading")}</h2>
      <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
        {fields.map((field) => (
          <li key={`${field.sourceId}-${field.fieldName}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {fieldLabel(field.fieldName)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_CLASSES[field.confidence] ?? CONFIDENCE_CLASSES.low}`}
              >
                {t(`confidence_${field.confidence}` as "confidence_high" | "confidence_medium" | "confidence_low")}
              </span>
            </div>
            <span className="text-sm font-medium text-zinc-900">{field.value}</span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>{t("retrievedAt", { time: format.relativeTime(new Date(field.retrievedAt)) })}</span>
              {field.sourceUrl && (
                <>
                  <span aria-hidden>&middot;</span>
                  <a
                    href={field.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2 hover:text-zinc-700"
                  >
                    {t("officialSource")}
                  </a>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
