"use client";

import { useState } from "react";

/** Task brief PART B item 15: every UniPath-computed/estimated date must be
 * able to show its own reasoning on demand. `lines` are pre-resolved plain
 * strings from the parent Server Component (same split RouteSubSteps.tsx
 * already uses) so this stays a small, i18n-free client component. */
export default function WhyThisDate({
  lines,
  toggleLabel,
  explainer,
  sourceUrl,
  sourceLabel,
}: {
  lines: string[];
  toggleLabel: string;
  explainer: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;

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
        {toggleLabel}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <p className="text-zinc-500">{explainer}</p>
          <ol className="flex flex-col gap-1 border-l border-zinc-200 pl-3">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="w-fit font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              {sourceLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
