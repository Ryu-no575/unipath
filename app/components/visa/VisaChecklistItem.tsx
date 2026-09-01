"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { toggleVisaChecklistItemAction } from "@/app/lib/actions/visa";
import type { VisaChecklistItemView } from "@/app/lib/data/visa";

export default function VisaChecklistItem({
  locale,
  journeyId,
  item,
}: {
  locale: AppLocale;
  journeyId: string;
  item: VisaChecklistItemView;
}) {
  const t = useTranslations("Visa");
  const itemT = useTranslations("VisaItemOptions");
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleVisaChecklistItemAction(locale, journeyId, item.id, !item.completed);
    });
  }

  return (
    <li className="flex items-start gap-3 py-3">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={item.completed}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
          item.completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 bg-white text-transparent hover:border-zinc-400"
        } disabled:opacity-60`}
      >
        ✓
      </button>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className={`text-sm font-medium ${item.completed ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
          {item.title || itemT(item.itemKey)}
        </span>
        {item.description && <span className="text-sm text-zinc-500">{item.description}</span>}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
          >
            {t("officialSourceLink")}
          </a>
        )}
      </div>
      {!item.required && <span className="shrink-0 text-xs text-zinc-400">{t("optionalLabel")}</span>}
    </li>
  );
}
