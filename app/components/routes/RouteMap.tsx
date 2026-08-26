import type { RouteStep } from "@/app/lib/routes/types";
import RouteStepNode from "./RouteStepNode";

export default function RouteMap({ steps, userTimezone }: { steps: RouteStep[]; userTimezone: string | null }) {
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6">
      {steps.map((step, index) => (
        <RouteStepNode key={step.id} step={step} isLast={index === steps.length - 1} userTimezone={userTimezone} />
      ))}
    </div>
  );
}
