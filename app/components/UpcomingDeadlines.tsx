import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/app/lib/journey";
import { getUrgency } from "@/app/lib/journey";
import CategoryBadge from "./calendar/CategoryBadge";
import UrgencyBadge from "./UrgencyBadge";

const WINDOW_DAYS = 60;

export default function UpcomingDeadlines({ events }: { events: CalendarEvent[] }) {
  const t = useTranslations("UpcomingDeadlines");
  const now = new Date();

  const active = events.filter((event) => !event.completed);
  const overdue = active.filter((event) => getUrgency(event.dueAt, now).days < 0);
  const upcoming = active.filter((event) => {
    const days = getUrgency(event.dueAt, now).days;
    return days >= 0 && days <= WINDOW_DAYS;
  });

  if (overdue.length === 0 && upcoming.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{t("heading")}</h2>

      {overdue.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
            {t("overdueHeading")}
          </span>
          <EventRows events={overdue} />
        </div>
      )}

      {upcoming.length > 0 && <EventRows events={upcoming} />}
    </div>
  );
}

function EventRows({ events }: { events: CalendarEvent[] }) {
  const t = useTranslations("UpcomingDeadlines");

  return (
    <ul className="flex flex-col divide-y divide-zinc-100">
      {events.map((event) => {
        const prefix = event.kind === "deadline" ? event.title : event.subtitle;
        const mainLabel = event.kind === "deadline" ? t("applicationDeadline") : event.title;

        return (
          <li
            key={event.id}
            className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate text-sm font-medium text-zinc-900">
                {prefix ? `${prefix} — ` : ""}
                {mainLabel}
              </span>
              <CategoryBadge category={event.category} className="w-fit" />
            </div>
            <UrgencyBadge dueAt={event.dueAt} className="w-fit shrink-0" />
          </li>
        );
      })}
    </ul>
  );
}
