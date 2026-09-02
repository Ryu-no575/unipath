"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { RouteStep } from "@/app/lib/routes/types";
import { ROUTE_PHASES, ROUTE_STEP_PHASE } from "@/app/lib/routes/step-style";
import RouteStepNode from "./RouteStepNode";

/** "Your Future Path": groups the flat step list into the 5 phases task
 * brief PART A item 14 asks for -- a first-time user sees "PREPARE / APPLY /
 * DECIDE / MOVE / ARRIVE" instead of one long undifferentiated list. A phase
 * with zero steps in it (e.g. DECIDE before any admission exists) is simply
 * not rendered. The "Today" marker up top is purely a visual anchor -- it
 * carries no date of its own and never changes how RouteStepNode resolves
 * official/suggested/estimated/unverified dates. */
export default function RouteMap({ steps, userTimezone }: { steps: RouteStep[]; userTimezone: string | null }) {
  const t = useTranslations("Routes");
  const reduceMotion = useReducedMotion();
  const visiblePhases = ROUTE_PHASES.filter((phase) => steps.some((s) => ROUTE_STEP_PHASE[s.type] === phase));

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-soft sm:p-8">
      <h2 className="text-base font-semibold tracking-tight text-navy-900">{t("futurePathHeading")}</h2>

      <div className="relative flex items-start gap-4 pb-1">
        {visiblePhases.length > 0 && (
          <motion.span
            aria-hidden="true"
            className="absolute left-[15px] top-8 bottom-[-1.5rem] w-px bg-gradient-to-b from-gold to-zinc-200"
            style={{ transformOrigin: "top" }}
            initial={reduceMotion ? undefined : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
        <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-navy-900 ring-4 ring-white">
          •
        </span>
        <span className="pt-1.5 text-sm font-semibold text-navy-900">{t("futurePathToday")}</span>
      </div>

      {visiblePhases.map((phase) => {
        const phaseSteps = steps.filter((s) => ROUTE_STEP_PHASE[s.type] === phase);
        return (
          <div key={phase} className="flex flex-col">
            <span className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {t(`routePhaseHeading_${phase}`)}
            </span>
            {phaseSteps.map((step, index) => (
              <RouteStepNode
                key={step.id}
                step={step}
                isLast={index === phaseSteps.length - 1}
                userTimezone={userTimezone}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
