import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { RouteStep } from "@/app/lib/routes/types";
import { routeStepLabel } from "@/app/lib/routes/labels";
import { ROUTE_STEP_STYLES } from "@/app/lib/routes/step-style";
import DeadlineTime from "@/app/components/DeadlineTime";
import RouteStepIcon from "./RouteStepIcon";

const NODE_STATUS_CLASSES: Record<RouteStep["status"], string> = {
  done: "bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50",
  current: "bg-blue-600 text-white ring-4 ring-blue-100",
  upcoming: "bg-zinc-100 text-zinc-400 ring-4 ring-white",
};

const TITLE_STATUS_CLASSES: Record<RouteStep["status"], string> = {
  done: "text-zinc-500",
  current: "text-zinc-900",
  upcoming: "text-zinc-400",
};

const LINE_STATUS_CLASSES: Record<RouteStep["status"], string> = {
  done: "bg-emerald-200",
  current: "bg-zinc-200",
  upcoming: "bg-zinc-200",
};

export default function RouteStepNode({
  step,
  isLast,
  userTimezone,
}: {
  step: RouteStep;
  isLast: boolean;
  userTimezone: string | null;
}) {
  const t = useTranslations("Routes");
  const stepTypes = useTranslations("RouteStepTypeOptions");
  const stepDetails = useTranslations("RouteStepDetails");
  const documentTypes = useTranslations("DocumentTypeOptions");
  const format = useFormatter();

  const label = routeStepLabel(step, {
    stepTypes,
    stepDetails,
    documentTypes: (key) => documentTypes(key),
  });
  const style = ROUTE_STEP_STYLES[step.type];

  return (
    <div className="relative flex gap-4 pb-7 last:pb-0">
      {!isLast && (
        <div className={`absolute left-[15px] top-8 bottom-0 w-px ${LINE_STATUS_CLASSES[step.status]}`} />
      )}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${NODE_STATUS_CLASSES[step.status]}`}
      >
        {step.type === "arrival" ? (
          <span aria-hidden className="text-sm leading-none">
            ★
          </span>
        ) : (
          <RouteStepIcon type={step.type} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-0.5">
        {step.status === "current" && (
          <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            {t("youAreHere")}
          </span>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className={`text-sm font-semibold ${TITLE_STATUS_CLASSES[step.status]}`}>{label.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badgeClass}`}>
            {stepTypes(step.type)}
          </span>
        </div>
        <p className="text-sm text-zinc-500">{label.detail}</p>

        {step.date && (step.date.officialDate || step.date.suggestedDate) && (
          <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
            {step.date.officialDate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {t("officialDate")}
                </span>
                <DeadlineTime
                  isoInstant={step.date.officialDate}
                  sourceTimezone={step.date.officialTimezone ?? "UTC"}
                  userTimezone={userTimezone}
                />
              </div>
            )}
            {step.date.suggestedDate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {step.date.suggestedSource === "task" ? t("suggestedDateTask") : t("suggestedDateUnipath")}
                </span>
                <span className="text-sm text-zinc-700">
                  {format.dateTime(new Date(step.date.suggestedDate), "long")}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
          {step.calendarLinked && (
            <Link href="/calendar" className="font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
              {t("viewInCalendar")}
            </Link>
          )}
          {step.applicationId && (
            <Link
              href={`/applications/${step.applicationId}`}
              className="font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
            >
              {t("viewApplication")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
