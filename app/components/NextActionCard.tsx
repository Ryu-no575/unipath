"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { TaskType } from "@/app/lib/supabase/database.types";
import { toggleTaskCompletedAction } from "@/app/lib/actions/tasks";
import CategoryBadge from "./calendar/CategoryBadge";
import UrgencyBadge from "./UrgencyBadge";

export interface NextActionTaskView {
  id: string;
  title: string;
  taskType: TaskType;
  dueAt: string | null;
  applicationId: string | null;
  universityName: string | null;
}

/** Shown only when there's no real task yet to surface -- derived from the
 * user's active Route's own currentStep (see routeStepHref in
 * app/lib/routes/labels.ts), so a brand-new "exploring" profile still gets a
 * concrete single next step ("Find My Match") instead of a dead-end "all
 * caught up" (AGENTS.md section 12/13). `dueAt` is a UniPath Suggested date,
 * never an official one -- these steps only reach here when they have no
 * verified deadline of their own. */
export interface NextActionFallbackView {
  title: string;
  detail: string;
  href: string;
  dueAt: string | null;
}

export default function NextActionCard({
  locale,
  task,
  fallback,
}: {
  locale: AppLocale;
  task: NextActionTaskView | null;
  fallback?: NextActionFallbackView | null;
}) {
  const t = useTranslations("NextAction");
  const [isPending, startTransition] = useTransition();

  function markComplete() {
    if (!task) return;
    startTransition(async () => {
      await toggleTaskCompletedAction(locale, task.id, task.applicationId, true);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50 p-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
        {t("heading")}
      </h2>

      {task ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-zinc-900">{task.title}</p>
            {task.universityName && (
              <p className="text-sm text-zinc-500">{task.universityName}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={task.taskType} />
            {task.dueAt && <UrgencyBadge dueAt={task.dueAt} />}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={markComplete}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
            >
              {isPending ? t("saving") : t("markComplete")}
            </button>
            {task.applicationId && (
              <Link
                href={`/applications/${task.applicationId}`}
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
              >
                {t("viewApplication")}
              </Link>
            )}
          </div>
        </>
      ) : fallback ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-zinc-900">{fallback.title}</p>
            <p className="text-sm text-zinc-500">{fallback.detail}</p>
          </div>

          {fallback.dueAt && (
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyBadge dueAt={fallback.dueAt} />
              <span className="text-xs text-zinc-400">{t("suggestedDate")}</span>
            </div>
          )}

          <div className="pt-2">
            <Link
              href={fallback.href}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {t("continue")}
            </Link>
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500">{t("allCaughtUp")}</p>
      )}
    </div>
  );
}
