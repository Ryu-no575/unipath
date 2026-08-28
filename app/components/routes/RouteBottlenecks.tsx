import { useTranslations } from "next-intl";
import type { Bottleneck, BottleneckSeverity } from "@/app/lib/routes/types";

const SEVERITY_CLASSES: Record<BottleneckSeverity, string> = {
  critical: "bg-red-50 text-red-700",
  high: "bg-amber-50 text-amber-700",
  medium: "bg-zinc-100 text-zinc-600",
};

/** Task brief item 9: the real, ranked reasons this specific route is hard
 * -- see app/lib/routes/bottleneckAnalysis.ts for how each entry traces back
 * to a real GapAnalysis/Feasibility/Capacity number. Renders nothing when
 * the route has none (never pads the list to look more "analytical"). */
export default function RouteBottlenecks({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  const t = useTranslations("Routes");
  const kindT = useTranslations("RouteBottleneckKinds");
  const severityT = useTranslations("RouteBottleneckSeverity");

  if (bottlenecks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-900">{t("bottlenecksHeading")}</h3>
      <ol className="flex flex-col gap-2">
        {bottlenecks.map((b, i) => (
          <li key={`${b.kind}-${i}`} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="text-sm font-semibold text-zinc-400">{i + 1}.</span>
              <span className="text-sm text-zinc-800">{kindT(b.kind, b.params)}</span>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[b.severity]}`}>
              {severityT(b.severity)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
