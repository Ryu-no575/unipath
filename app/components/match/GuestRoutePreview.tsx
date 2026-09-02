"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import type { RouteStepType } from "@/app/lib/routes/types";
import RouteStepIcon from "@/app/components/routes/RouteStepIcon";

/** A fixed, generic milestone sequence -- deliberately not the real Route
 * engine (app/lib/routes/generateRoute.ts), which needs an account profile,
 * passport data, and applications this guest doesn't have. This is only a
 * preview of the *shape* of a route (task brief section 3's "Route
 * Preview"): no dates except the program's own verified deadline when known,
 * no done/current status, no personalization. */
const PREVIEW_STEP_TYPES: RouteStepType[] = [
  "document",
  "application",
  "admission",
  "visa",
  "housing",
  "travel",
  "arrival",
];

export default function GuestRoutePreview({
  universityName,
  programName,
  deadlineLabel,
  resultsHref,
}: {
  universityName: string;
  programName: string | null;
  deadlineLabel: string | null;
  resultsHref: string;
}) {
  const t = useTranslations("Guest");
  const routes = useTranslations("Routes");
  const stepTypes = useTranslations("RouteStepTypeOptions");
  const reduceMotion = useReducedMotion();
  const nodeCount = PREVIEW_STEP_TYPES.length + 1;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy-900">
          {t("routePreviewHeading", { university: universityName })}
        </h2>
        <p className="text-sm text-zinc-500">
          {programName ? `${programName} · ${universityName}` : universityName}
        </p>
      </div>

      <div className="flex flex-col">
        <div className="relative flex gap-4 pb-7">
          <motion.span
            aria-hidden="true"
            className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-gold to-zinc-200"
            style={{ transformOrigin: "top" }}
            initial={reduceMotion ? undefined : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-navy-900 ring-4 ring-white">
            •
          </span>
          <span className="pt-1.5 text-sm font-semibold text-navy-900">{routes("futurePathToday")}</span>
        </div>
        {PREVIEW_STEP_TYPES.map((type, index) => {
          const isLast = index === PREVIEW_STEP_TYPES.length - 1;
          return (
            <motion.div
              key={type}
              className="relative flex gap-4 pb-7 last:pb-0"
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + (index / nodeCount) * 0.4 }}
            >
              {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-zinc-200" aria-hidden />
              )}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-4 ring-white">
                <RouteStepIcon type={type} />
              </div>
              <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                <span className="text-sm font-semibold text-navy-900">{stepTypes(type)}</span>
                {type === "application" && deadlineLabel && (
                  <span className="text-sm text-zinc-500">
                    {t("routePreviewDeadline", { date: deadlineLabel })}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-400">{t("routePreviewFootnote")}</p>

      <Link
        href={resultsHref}
        className="w-fit text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
      >
        {t("backToResults")}
      </Link>
    </div>
  );
}
