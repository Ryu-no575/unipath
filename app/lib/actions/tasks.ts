"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { TaskType } from "@/app/lib/supabase/database.types";

export interface TaskFormInput {
  title: string;
  description: string;
  taskType: TaskType;
  /** "" or a value from <input type="datetime-local">. */
  dueAt: string;
  priority: number;
}

export interface TaskActionResult {
  error?: string;
}

function revalidateTaskPaths(locale: AppLocale, applicationId: string | null) {
  if (applicationId) revalidatePath(`/${locale}/applications/${applicationId}`);
  revalidatePath(`/${locale}/applications`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/calendar`);
}

export async function createTaskAction(
  locale: AppLocale,
  applicationId: string,
  input: TaskFormInput,
): Promise<TaskActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const timezone = profile?.timezone || "UTC";

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    application_id: applicationId,
    title,
    description: input.description.trim() || null,
    task_type: input.taskType,
    due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
    timezone,
    priority: input.priority,
    completed: false,
  });
  if (error) return { error: error.message };

  revalidateTaskPaths(locale, applicationId);
  return {};
}

export async function updateTaskAction(
  locale: AppLocale,
  taskId: string,
  applicationId: string | null,
  input: TaskFormInput,
): Promise<TaskActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required." };

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description: input.description.trim() || null,
      task_type: input.taskType,
      due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      priority: input.priority,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateTaskPaths(locale, applicationId);
  return {};
}

export async function deleteTaskAction(
  locale: AppLocale,
  taskId: string,
  applicationId: string | null,
): Promise<TaskActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateTaskPaths(locale, applicationId);
  return {};
}

export async function toggleTaskCompletedAction(
  locale: AppLocale,
  taskId: string,
  applicationId: string | null,
  completed: boolean,
): Promise<TaskActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("tasks")
    .update({ completed })
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateTaskPaths(locale, applicationId);
  return {};
}
