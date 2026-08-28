import { useTranslations } from "next-intl";
import type { RouteScenario } from "@/app/lib/routes/types";

/** Task brief item 11: What-if scenarios -- each one a real re-run of the
 * same feasibility calculation under one changed, real assumption (see
 * app/lib/routes/scenarioSimulation.ts). Renders nothing when this route has
 * none computable from real data (task brief item 11: "実データから計算可能な
 * ものだけ"). */
export default function RouteScenarios({ scenarios }: { scenarios: RouteScenario[] }) {
  const t = useTranslations("Routes");
  const kindT = useTranslations("RouteScenarioKinds");
  const levelT = useTranslations("RouteFeasibilityLevelOptions");

  if (scenarios.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-900">{t("scenariosHeading")}</h3>
      <ul className="flex flex-col gap-2">
        {scenarios.map((s, i) => (
          <li key={`${s.kind}-${i}`} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            <p className="font-medium text-zinc-900">{kindT(s.kind, s.params)}</p>
            <p className="text-zinc-500">
              {levelT(s.beforeLevel)} → {levelT(s.afterLevel)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
