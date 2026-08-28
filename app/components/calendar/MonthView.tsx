"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CalendarEvent } from "@/app/lib/journey";
import { TASK_CATEGORY_STYLES } from "@/app/lib/task-categories";
import CategoryBadge from "./CategoryBadge";
import UrgencyBadge from "../UrgencyBadge";

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

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function MonthView({
  events,
  userTimezone,
}: {
  events: CalendarEvent[];
  userTimezone: string | null;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const zone = userTimezone ?? "UTC";

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(event.dueAt, zone);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events, zone]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ key: string; day: number } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `${year}-${pad(month + 1)}-${pad(d)}`, day: d });
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    cursor,
  );
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 1970-01-04 was a Sunday, a stable anchor for building a Sun-Sat header.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(1970, 0, 4 + i)));
  }, [locale]);

  const todayKey = dayKey(new Date().toISOString(), zone);
  const selectedEvents = selectedKey ? (eventsByDay.get(selectedKey) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          aria-label={t("previousMonth")}
        >
          ←
        </button>
        <span className="text-sm font-semibold text-zinc-900">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          aria-label={t("nextMonth")}
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400">
        {weekdayLabels.map((label, i) => (
          <div key={`${label}-${i}`}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} />;
          const dayEvents = eventsByDay.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedKey;

          return (
            <button
              type="button"
              key={cell.key}
              onClick={() => setSelectedKey(cell.key === selectedKey ? null : cell.key)}
              className={`flex min-h-16 flex-col items-start gap-1 rounded-md border p-1.5 text-left transition-colors ${
                isSelected ? "border-zinc-900" : "border-zinc-200"
              } ${isToday ? "bg-zinc-50" : "bg-white"} hover:border-zinc-400`}
            >
              <span
                className={`text-xs ${isToday ? "font-semibold text-zinc-900" : "text-zinc-500"}`}
              >
                {cell.day}
              </span>
              <div className="flex flex-wrap gap-1">
                {dayEvents.slice(0, 4).map((event) => (
                  <span
                    key={event.id}
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${TASK_CATEGORY_STYLES[event.category].dotClass}`}
                  />
                ))}
              </div>
              {dayEvents.length > 0 && (
                <span className="sr-only">{t("eventsOnDay", { count: dayEvents.length })}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedKey && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
              new Date(`${selectedKey}T00:00:00`),
            )}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100">
              {selectedEvents.map((event) => {
                const prefix = event.kind === "deadline" ? event.title : event.subtitle;
                const mainLabel =
                  event.kind === "deadline" ? t("applicationDeadline") : event.title;
                return (
                  <li
                    key={event.id}
                    className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-zinc-900">
                        {prefix ? `${prefix} — ` : ""}
                        {mainLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge category={event.category} className="w-fit" />
                        {event.origin === "route_generated" && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                            {t("suggestedByRoute")}
                          </span>
                        )}
                      </div>
                    </div>
                    <UrgencyBadge dueAt={event.dueAt} className="w-fit shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
