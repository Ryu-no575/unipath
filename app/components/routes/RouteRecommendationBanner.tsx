import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { RouteRecommendation } from "@/app/lib/routes/types";
import { routeReasonLabel } from "@/app/lib/routes/labels";

/** Task brief item 15: surfaces one Recommended route (routeRecommendation.ts)
 * without removing the user's ability to pick any other -- every RouteCard
 * below this banner stays fully clickable/selectable regardless. */
export default function RouteRecommendationBanner({ recommendation }: { recommendation: RouteRecommendation }) {
  const t = useTranslations("Routes");
  const typeT = useTranslations("RouteTypeOptions");
  const reasonsT = useTranslations("RouteReasons");

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{t("recommendedHeading")}</span>
      <Link href={`/routes/${recommendation.recommendedType}`} className="w-fit text-lg font-semibold text-zinc-900 hover:underline">
        {typeT(recommendation.recommendedType)}
      </Link>
      {recommendation.reasons.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {recommendation.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-600" aria-hidden />
              <span>{routeReasonLabel(reason, reasonsT)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-emerald-700">{t("recommendedDisclaimer")}</p>
    </div>
  );
}
