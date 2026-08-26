import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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

const STATUS_STYLES: Record<JourneyStepStatus, string> = {
  done: "border-emerald-200 bg-emerald-50",
  inProgress: "border-blue-200 bg-blue-50",
  available: "border-zinc-200 bg-white",
  notStarted: "border-zinc-200 bg-white",
  comingLater: "border-zinc-100 bg-zinc-50",
};

export default function JourneyProgress({ steps }: { steps: JourneyStep[] }) {
  const t = useTranslations("Journey");
  const statusT = useTranslations("JourneyStatus");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{t("heading")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((step) => {
          const body = (
            <div
              className={`flex h-full flex-col gap-1.5 rounded-lg border px-4 py-3 transition-colors ${
                STATUS_STYLES[step.status]
              } ${step.href ? "hover:border-zinc-300" : ""} ${
                step.status === "comingLater" ? "opacity-60" : ""
              }`}
            >
              <span className="text-sm font-medium text-zinc-900">
                {t(`steps.${step.key}`)}
              </span>
              <span className="text-xs text-zinc-500">{step.detail ?? statusT(step.status)}</span>
            </div>
          );

          return step.href ? (
            <Link key={step.key} href={step.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={step.key} aria-disabled>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
