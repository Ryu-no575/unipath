import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { RouteStep, RouteStepDate } from "@/app/lib/routes/types";
import { routeStepLabel, routeSubStepLabel } from "@/app/lib/routes/labels";
import { ROUTE_STEP_STYLES } from "@/app/lib/routes/step-style";
import DeadlineTime from "@/app/components/DeadlineTime";
import RouteStepIcon from "./RouteStepIcon";
import RouteSubSteps from "./RouteSubSteps";
import DateTrustBadge from "./DateTrustBadge";
import WhyThisDate from "./WhyThisDate";

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

type Formatter = ReturnType<typeof useFormatter>;

/** Renders an EstimatedWindow without false precision (task brief item 17):
 * a qualitative label always wins when present; a real bounded window is
 * shown to day-level granularity only, never a fake exact instant. */
function formatEstimatedWindow(date: RouteStepDate, format: Formatter): string | null {
  const window = date.estimatedWindow;
  if (!window) return null;
  if (window.qualitativeLabel) return window.qualitativeLabel;
  if (window.startISO && window.endISO) {
    const start = format.dateTime(new Date(window.startISO), { month: "short", day: "numeric" });
    const end = format.dateTime(new Date(window.endISO), { month: "short", day: "numeric", year: "numeric" });
    return `${start} – ${end}`;
  }
  return null;
}

/** Task brief item 15's "Why this date?" -- the literal chain this specific
 * date came from, built only from what's already on RouteStepDate (never a
 * hand-authored explanation that could drift from the real computation). */
function buildWhyThisDateLines(
  date: RouteStepDate,
  t: ReturnType<typeof useTranslations<"Routes">>,
  format: Formatter,
): string[] {
  const lines: string[] = [];
  if (date.suggestedSource === "task") {
    lines.push(t("whyLineFromTask"));
  } else if (date.suggestedSource === "unipath" && date.officialDate) {
    lines.push(t("whyLineFromOfficialDeadline"));
  } else if (date.confidence === "estimated_window") {
    lines.push(date.officialSource ? t("whyLineEstimatedSourced", { source: date.officialSource.label }) : t("whyLineEstimatedUnsourced"));
  } else if (date.confidence === "unverified") {
    lines.push(t("whyLineUnverifiedBody"));
  }
  if (date.officialSource?.lastCheckedAt) {
    lines.push(t("whyLineLastChecked", { date: format.dateTime(new Date(date.officialSource.lastCheckedAt), "short") }));
  }
  return lines;
}

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
  const subStepTypes = useTranslations("RouteSubStepOptions");
  const format = useFormatter();

  const label = routeStepLabel(step, {
    stepTypes,
    stepDetails,
    documentTypes: (key) => documentTypes(key),
  });
  const style = ROUTE_STEP_STYLES[step.type];
  const subStepViews = step.subSteps.map((sub) => ({
    key: sub.key,
    title: routeSubStepLabel(sub, subStepTypes),
    dateText: sub.date?.suggestedDate
      ? format.dateTime(new Date(sub.date.suggestedDate), "long")
      : sub.date
        ? formatEstimatedWindow(sub.date, format)
        : null,
    done: sub.done,
  }));

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

        {step.date && (
          <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
            <DateTrustBadge confidence={step.date.confidence} />
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
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {t("officialSource")}
                </span>
                {step.date.officialSource ? (
                  step.date.officialSource.url ? (
                    <a
                      href={step.date.officialSource.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="w-fit text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                    >
                      {step.date.officialSource.label}
                    </a>
                  ) : (
                    <span className="text-sm text-zinc-700">{step.date.officialSource.label}</span>
                  )
                ) : (
                  <span className="text-sm text-zinc-500">{t("officialSourceUnavailable")}</span>
                )}
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
            {step.date.estimatedWindow && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {t("estimatedWindowLabel")}
                </span>
                <span className="text-sm text-zinc-700">{formatEstimatedWindow(step.date, format)}</span>
              </div>
            )}
            {step.date.confidence === "unverified" && (
              <p className="text-sm text-zinc-500">{t("dateBeingVerifiedBody")}</p>
            )}
            <WhyThisDate
              lines={buildWhyThisDateLines(step.date, t, format)}
              toggleLabel={t("whyThisDate")}
              explainer={t(`dateConfidenceExplainer_${step.date.confidence}`)}
              sourceUrl={step.date.officialSource?.url ?? null}
              sourceLabel={t("viewSource")}
            />
          </div>
        )}

        <RouteSubSteps items={subStepViews} showLabel={t("showSubSteps")} hideLabel={t("hideSubSteps")} />

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
