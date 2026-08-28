import { useLocale, useTranslations } from "next-intl";
import type { CalendarEvent } from "@/app/lib/journey";
import CategoryBadge from "./CategoryBadge";
import UrgencyBadge from "../UrgencyBadge";
import DeadlineTime from "../DeadlineTime";

function dayKey(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function TimelineView({
  events,
  userTimezone,
}: {
  events: CalendarEvent[];
  userTimezone: string | null;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        {t("empty")}
      </p>
    );
  }

  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.dueAt, userTimezone ?? event.timezone);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  const sortedKeys = Array.from(groups.keys()).sort();

  return (
    <div className="flex flex-col gap-6">
      {sortedKeys.map((key) => {
        const dayEvents = groups.get(key)!;
        const label = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
          new Date(`${key}T00:00:00`),
        );

        return (
          <div key={key} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
            <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              {dayEvents.map((event) => {
                const prefix = event.kind === "deadline" ? event.title : event.subtitle;
                const mainLabel =
                  event.kind === "deadline" ? t("applicationDeadline") : event.title;

                return (
                  <li
                    key={event.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-zinc-900">
                        {prefix ? `${prefix} — ` : ""}
                        {mainLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge category={event.category} />
                        {event.origin === "route_generated" && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                            {t("suggestedByRoute")}
                          </span>
                        )}
                        <DeadlineTime
                          isoInstant={event.dueAt}
                          sourceTimezone={event.timezone}
                          userTimezone={userTimezone}
                        />
                      </div>
                    </div>
                    <UrgencyBadge dueAt={event.dueAt} className="w-fit shrink-0" />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
