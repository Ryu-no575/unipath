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

export default function NextActionCard({
  locale,
  task,
}: {
  locale: AppLocale;
  task: NextActionTaskView | null;
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
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
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
      ) : (
        <p className="text-sm text-zinc-500">{t("allCaughtUp")}</p>
      )}
    </div>
  );
}
