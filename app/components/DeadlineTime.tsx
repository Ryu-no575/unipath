import { useLocale, useTranslations } from "next-intl";
import { formatInstantInZone, zonesDiffer } from "@/app/lib/timezone";

/** Renders a deadline in its source timezone (the university's, for an
 * admission cycle deadline) and, when it differs, a second line in the
 * viewer's own timezone — the "university local time + user local time"
 * structure the calendar is meant to support. */
export default function DeadlineTime({
  isoInstant,
  sourceTimezone,
  userTimezone,
}: {
  isoInstant: string;
  sourceTimezone: string;
  userTimezone: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("DeadlineTime");
  const sourceLabel = formatInstantInZone(isoInstant, sourceTimezone, locale);
  const showUserTime = zonesDiffer(sourceTimezone, userTimezone);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-zinc-900">
        {sourceLabel}{" "}
        <span className="text-xs font-normal text-zinc-400">({sourceTimezone})</span>
      </span>
      {showUserTime && (
        <span className="text-xs text-zinc-500">
          {t("yourTime", {
            time: formatInstantInZone(isoInstant, userTimezone!, locale),
            zone: userTimezone!,
          })}
        </span>
      )}
    </div>
  );
}
