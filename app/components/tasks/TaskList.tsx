"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database } from "@/app/lib/supabase/database.types";
import Progress from "../ui/Progress";
import TaskRow from "./TaskRow";
import TaskForm from "./TaskForm";

type TaskRowData = Database["public"]["Tables"]["tasks"]["Row"];

export default function TaskList({
  locale,
  applicationId,
  tasks,
  progress,
}: {
  locale: AppLocale;
  applicationId: string;
  tasks: TaskRowData[];
  progress: number;
}) {
  const t = useTranslations("Tasks");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">{t("heading")}</h2>
        <span className="text-sm font-medium text-zinc-500">
          {t("completedCount", {
            completed: tasks.filter((task) => task.completed).length,
            total: tasks.length,
          })}
        </span>
      </div>

      <Progress value={progress} />

      {editingId !== "new" && (
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          {t("addTask")}
        </button>
      )}

      {editingId === "new" && (
        <TaskForm locale={locale} applicationId={applicationId} onDone={() => setEditingId(null)} />
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100">
          {sorted.map((task) =>
            editingId === task.id ? (
              <li key={task.id} className="py-3">
                <TaskForm
                  locale={locale}
                  applicationId={applicationId}
                  task={task}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <TaskRow key={task.id} locale={locale} task={task} onEdit={() => setEditingId(task.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
