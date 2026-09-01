import { useTranslations } from "next-intl";
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
  const stepTypes = useTranslations("RouteStepTypeOptions");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">
          {t("routePreviewHeading", { university: universityName })}
        </h2>
        <p className="text-sm text-zinc-500">
          {programName ? `${programName} · ${universityName}` : universityName}
        </p>
      </div>

      <div className="flex flex-col">
        {PREVIEW_STEP_TYPES.map((type, index) => {
          const isLast = index === PREVIEW_STEP_TYPES.length - 1;
          return (
            <div key={type} className="relative flex gap-4 pb-7 last:pb-0">
              {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-zinc-200" aria-hidden />
              )}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-4 ring-white">
                <RouteStepIcon type={type} />
              </div>
              <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                <span className="text-sm font-semibold text-zinc-900">{stepTypes(type)}</span>
                {type === "application" && deadlineLabel && (
                  <span className="text-sm text-zinc-500">
                    {t("routePreviewDeadline", { date: deadlineLabel })}
                  </span>
                )}
              </div>
            </div>
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
