import { useTranslations } from "next-intl";
import type { RouteReason } from "@/app/lib/routes/types";
import { routeReasonLabel } from "@/app/lib/routes/labels";

export default function RouteReasonsList({ reasons }: { reasons: RouteReason[] }) {
  const t = useTranslations("Routes");
  const reasonsT = useTranslations("RouteReasons");

  if (reasons.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-900">{t("whyThisRoute")}</h3>
      <ul className="flex flex-col gap-1.5">
        {reasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden />
            <span>{routeReasonLabel(reason, reasonsT)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
