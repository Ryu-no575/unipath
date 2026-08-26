"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/app/lib/journey";
import TimelineView from "./TimelineView";
import MonthView from "./MonthView";

export default function CalendarView({
  events,
  userTimezone,
}: {
  events: CalendarEvent[];
  userTimezone: string | null;
}) {
  const t = useTranslations("Calendar");
  const [view, setView] = useState<"timeline" | "month">("timeline");

  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex w-fit rounded-md border border-zinc-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setView("timeline")}
          aria-pressed={view === "timeline"}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "timeline" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {t("timelineView")}
        </button>
        <button
          type="button"
          onClick={() => setView("month")}
          aria-pressed={view === "month"}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "month" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {t("monthView")}
        </button>
      </div>

      {view === "timeline" ? (
        <TimelineView events={events} userTimezone={userTimezone} />
      ) : (
        <MonthView events={events} userTimezone={userTimezone} />
      )}
    </div>
  );
}
