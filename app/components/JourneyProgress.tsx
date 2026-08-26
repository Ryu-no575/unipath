import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Card from "@/app/components/ui/Card";
import SectionHeader from "@/app/components/ui/SectionHeader";

export type JourneyStepStatus =
  | "done"
  | "inProgress"
  | "available"
  | "notStarted"
  | "comingLater";

export interface JourneyStep {
  key:
    | "profile"
    | "explore"
    | "shortlist"
    | "applications"
    | "funding"
    | "visa"
    | "move"
    | "arrival";
  status: JourneyStepStatus;
  href: string | null;
  detail?: string;
}

const DOT_CLASSES: Record<JourneyStepStatus, string> = {
  done: "bg-emerald-500",
  inProgress: "bg-blue-600 ring-4 ring-blue-100",
  available: "bg-blue-600 ring-4 ring-blue-100",
  notStarted: "bg-zinc-300",
  comingLater: "bg-zinc-200",
};

const LABEL_CLASSES: Record<JourneyStepStatus, string> = {
  done: "text-zinc-500",
  inProgress: "text-zinc-900 font-semibold",
  available: "text-zinc-900 font-semibold",
  notStarted: "text-zinc-400",
  comingLater: "text-zinc-300",
};

const LINE_DONE = "bg-emerald-300";
const LINE_UPCOMING = "bg-zinc-200";

/** The "you are here" step: the first one that's actionable right now. */
function isCurrent(status: JourneyStepStatus): boolean {
  return status === "inProgress" || status === "available";
}

/** One shared horizontal step rail for the whole journey (AGENTS.md section
 * 4/11) -- same dot-and-line visual language as the Route map, just laid out
 * horizontally for the Home summary. */
export default function JourneyProgress({
  steps,
  routeHref,
  routeDetail,
}: {
  steps: JourneyStep[];
  /** "View full route" -- kept next to the rail so Home's Journey and
   * Plan's Route stay visibly the same thing (AGENTS.md section 5). */
  routeHref?: string;
  routeDetail?: string;
}) {
  const t = useTranslations("Journey");
  const statusT = useTranslations("JourneyStatus");
  const currentIndex = steps.findIndex((step) => isCurrent(step.status));

  return (
    <Card>
      <SectionHeader
        title={t("heading")}
        action={
          routeHref && (
            <Link
              href={routeHref}
              className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
            >
              {t("viewFullRoute")}
            </Link>
          )
        }
      />
      {routeDetail && <p className="mt-1 text-sm text-zinc-500">{routeDetail}</p>}

      <div className="mt-6 flex items-start overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const current = index === currentIndex;
          const body = (
            <div className="flex flex-col items-center gap-2 px-1">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${DOT_CLASSES[step.status]}`}
                aria-hidden
              />
              <span className={`whitespace-nowrap text-xs ${LABEL_CLASSES[step.status]}`}>
                {t(`steps.${step.key}`)}
              </span>
              {current && (
                <span className="whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  {t("youAreHere")}
                </span>
              )}
            </div>
          );

          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-center">
              {step.href ? (
                <Link href={step.href} className="shrink-0">
                  {body}
                </Link>
              ) : (
                <div className="shrink-0" aria-disabled title={statusT(step.status)}>
                  {body}
                </div>
              )}
              {index < steps.length - 1 && (
                <span
                  className={`mx-1 mt-[-16px] h-px min-w-6 flex-1 ${
                    step.status === "done" ? LINE_DONE : LINE_UPCOMING
                  }`}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
