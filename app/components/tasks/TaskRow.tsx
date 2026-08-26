"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database } from "@/app/lib/supabase/database.types";
import { PRIORITY_LABEL_KEYS } from "@/app/lib/journey";
import { deleteTaskAction, toggleTaskCompletedAction } from "@/app/lib/actions/tasks";
import CategoryBadge from "../calendar/CategoryBadge";
import UrgencyBadge from "../UrgencyBadge";

type TaskRowData = Database["public"]["Tables"]["tasks"]["Row"];

export default function TaskRow({
  locale,
  task,
  onEdit,
}: {
  locale: AppLocale;
  task: TaskRowData;
  onEdit: () => void;
}) {
  const t = useTranslations("Tasks");
  const priorityT = useTranslations("PriorityLabels");
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleTaskCompletedAction(locale, task.id, task.application_id, !task.completed);
    });
  }

  function remove() {
    if (typeof window !== "undefined" && !window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      await deleteTaskAction(locale, task.id, task.application_id);
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={toggle}
          disabled={isPending}
          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
          aria-label={t("markCompleteFor", { title: task.title })}
        />
        <div className="flex flex-col gap-1.5">
          <span
            className={`text-sm ${
              task.completed ? "text-zinc-400 line-through" : "text-zinc-800"
            }`}
          >
            {task.title}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={task.task_type} />
            <span className="text-xs text-zinc-400">
              {priorityT(PRIORITY_LABEL_KEYS[task.priority as 1 | 2 | 3] ?? "medium")}
            </span>
            {task.due_at && !task.completed && <UrgencyBadge dueAt={task.due_at} />}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 pl-7 sm:pl-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 hover:underline"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 hover:underline"
        >
          {t("delete")}
        </button>
      </div>
    </li>
  );
}
