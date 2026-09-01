"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { TaskType } from "@/app/lib/supabase/database.types";
import { createTaskAction } from "@/app/lib/actions/tasks";
import Badge from "@/app/components/ui/Badge";

/**
 * One generic guidance item (Housing/Travel/Arrival checklists -- these are
 * UniPath's own preparation guidance, not an official per-destination
 * requirement, so unlike the Visa checklist there is no source to cite).
 * "Add to my tasks" writes a real `tasks` row via the existing task action
 * so it immediately shows up on /calendar and can win Home's Next Action --
 * the same integration path every other Route step already uses, rather
 * than a second, disconnected checklist state (AGENTS.md section 4/11).
 */
export default function GuidanceChecklistItem({
  locale,
  applicationId,
  taskType,
  title,
  description,
  alreadyAdded,
}: {
  locale: AppLocale;
  applicationId: string;
  taskType: TaskType;
  title: string;
  description?: string;
  alreadyAdded: boolean;
}) {
  const t = useTranslations("PlanGuidance");
  const [added, setAdded] = useState(alreadyAdded);
  const [isPending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await createTaskAction(locale, applicationId, {
        title,
        description: description ?? "",
        taskType,
        dueAt: "",
        priority: 2,
      });
      if (!result.error) setAdded(true);
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-zinc-900">{title}</span>
        {description && <span className="text-sm text-zinc-500">{description}</span>}
      </div>
      {added ? (
        <Badge tone="success">{t("added")}</Badge>
      ) : (
        <button
          type="button"
          onClick={add}
          disabled={isPending}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          {isPending ? t("adding") : t("addToTasks")}
        </button>
      )}
    </li>
  );
}
