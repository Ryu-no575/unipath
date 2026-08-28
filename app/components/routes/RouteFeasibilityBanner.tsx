import { useTranslations } from "next-intl";
import type { RouteFeasibility } from "@/app/lib/routes/types";

const BANNER_CLASSES: Record<RouteFeasibility["status"], string> = {
  feasible: "",
  unknown_deadline: "border-zinc-200 bg-zinc-50 text-zinc-600",
  tight: "border-amber-200 bg-amber-50 text-amber-800",
  infeasible: "border-red-200 bg-red-50 text-red-800",
};

/** Task brief item 15/16: never render an "Easy" route when the real
 * runway can't fit its own required prep, and never invent a date when no
 * deadline has been verified yet. Renders nothing for the ordinary
 * "feasible" case -- this is a warning, not a status readout. */
export default function RouteFeasibilityBanner({ feasibility }: { feasibility: RouteFeasibility }) {
  const t = useTranslations("Routes");

  if (feasibility.status === "feasible") return null;

  const messageKey =
    feasibility.status === "unknown_deadline"
      ? "feasibilityUnknownDeadline"
      : feasibility.status === "tight"
        ? "feasibilityTight"
        : "feasibilityInfeasible";

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${BANNER_CLASSES[feasibility.status]}`}>
      {t(messageKey)}
    </div>
  );
}
