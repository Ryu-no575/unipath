"use client";

import { useState } from "react";

export interface RouteSubStepView {
  key: string;
  title: string;
  dateText: string | null;
  done: boolean;
}

/** Progressive Disclosure (task brief item 7): the Route Map shows only the
 * parent step ("English preparation"); this renders the collapsed toggle
 * and, once opened, the study-plan/portfolio-iteration/entrance-exam
 * breakdown underneath it. Labels are resolved server-side (routeSubStepLabel
 * in the parent Server Component) and passed in as plain strings so this
 * client component doesn't need its own i18n wiring. */
export default function RouteSubSteps({
  items,
  showLabel,
  hideLabel,
}: {
  items: RouteSubStepView[];
  showLabel: string;
  hideLabel: string;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
        aria-expanded={open}
      >
        <span aria-hidden className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
        {open ? hideLabel : showLabel}
      </button>

      {open && (
        <ol className="mt-2 flex flex-col gap-1.5 border-l border-zinc-200 pl-3">
          {items.map((item) => (
            <li key={item.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className={item.done ? "text-zinc-400 line-through" : "text-zinc-700"}>{item.title}</span>
              {item.dateText && <span className="shrink-0 text-zinc-400">{item.dateText}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
