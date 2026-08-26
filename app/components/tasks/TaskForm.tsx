"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database, TaskType } from "@/app/lib/supabase/database.types";
import { TASK_TYPES } from "@/app/lib/task-categories";
import { PRIORITY_LABEL_KEYS, TASK_PRIORITIES } from "@/app/lib/journey";
import { createTaskAction, updateTaskAction } from "@/app/lib/actions/tasks";

type TaskRowData = Database["public"]["Tables"]["tasks"]["Row"];

const fieldClasses =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-xs font-medium text-zinc-600";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function TaskForm({
  locale,
  applicationId,
  task,
  onDone,
}: {
  locale: AppLocale;
  applicationId: string;
  task?: TaskRowData;
  onDone: () => void;
}) {
  const t = useTranslations("Tasks");
  const typeT = useTranslations("TaskTypeOptions");
  const priorityT = useTranslations("PriorityLabels");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [taskType, setTaskType] = useState<TaskType>(task?.task_type ?? "document");
  const [dueAt, setDueAt] = useState(toDatetimeLocal(task?.due_at ?? null));
  const [priority, setPriority] = useState(task?.priority ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { title, description, taskType, dueAt, priority };
      const result = task
        ? await updateTaskAction(locale, task.id, task.application_id, input)
        : await createTaskAction(locale, applicationId, input);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClasses}>{t("titleLabel")}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClasses}>{t("descriptionLabel")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("typeLabel")}</span>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as TaskType)}
            className={fieldClasses}
          >
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeT(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("priorityLabel")}</span>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className={fieldClasses}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityT(PRIORITY_LABEL_KEYS[p])}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClasses}>{t("dueAtLabel")}</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={fieldClasses}
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("saving") : task ? t("saveChanges") : t("addTask")}
        </button>
      </div>
    </form>
  );
}
