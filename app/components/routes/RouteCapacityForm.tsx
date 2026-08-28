import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { RouteCapacity } from "@/app/lib/routes/types";
import { setWeeklyStudyHoursAction } from "@/app/lib/actions/routes";

const STATUS_CLASSES: Record<RouteCapacity["status"], string> = {
  unknown: "border-zinc-200 bg-zinc-50 text-zinc-500",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  mismatch: "border-amber-200 bg-amber-50 text-amber-800",
};

/** Task brief item 7: lets the user optionally declare how many hours/week
 * they can realistically dedicate, then compares it against this route's own
 * RouteWorkload total. Rendering "unknown" (not "ok") until the user sets a
 * value is the whole point -- a route must never be shown as comfortably
 * within capacity just because nothing was declared. */
export default function RouteCapacityForm({ capacity, locale }: { capacity: RouteCapacity; locale: AppLocale }) {
  const t = useTranslations("Routes");

  return (
    <div className="flex flex-col gap-3">
      <form action={setWeeklyStudyHoursAction.bind(null, locale)} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          {t("capacityInputLabel")}
          <input
            type="number"
            name="weeklyStudyHours"
            min={0}
            max={168}
            step={1}
            defaultValue={capacity.availableHoursPerWeek ?? ""}
            placeholder={t("capacityInputPlaceholder")}
            className="w-32 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {t("capacitySave")}
        </button>
      </form>

      <div className={`rounded-lg border px-3 py-2 text-sm ${STATUS_CLASSES[capacity.status]}`}>
        {capacity.status === "unknown" && t("capacityUnknown", { required: capacity.requiredHoursPerWeek })}
        {capacity.status === "ok" && t("capacityOk", { available: capacity.availableHoursPerWeek ?? 0, required: capacity.requiredHoursPerWeek })}
        {capacity.status === "mismatch" && (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t("capacityMismatchHeading")}</span>
            <span>
              {t("capacityMismatchDetail", {
                available: capacity.availableHoursPerWeek ?? 0,
                required: capacity.requiredHoursPerWeek,
              })}
            </span>
            <ul className="mt-1 list-disc pl-4">
              <li>{t("capacitySuggestionStartEarlier")}</li>
              <li>{t("capacitySuggestionReduceTargets")}</li>
              <li>{t("capacitySuggestionChooseBalanced")}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
