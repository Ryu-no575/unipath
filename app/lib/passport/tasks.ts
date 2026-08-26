import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import type { ReadinessItem } from "./readiness";

type Client = SupabaseClient<Database>;

const PREPARATION_LEAD_DAYS = 10;

/** The "UniPath suggested internal deadline" -- always a fixed number of
 * days before the official deadline (see task brief item 13's Jan 15 ->
 * Jan 5 example), never guessed per-requirement. */
export function suggestedPreparationDeadline(officialDeadlineIso: string | null): string | null {
  if (!officialDeadlineIso) return null;
  const d = new Date(officialDeadlineIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - PREPARATION_LEAD_DAYS);
  return d.toISOString();
}

/**
 * Creates one "document"-type task per still-missing, trackable requirement
 * on an application, skipping anything that already has a task with the
 * exact same title on that application (completed or not) so revisiting a
 * Passport/application page never piles up duplicate tasks. Requirements
 * classified "unknown" (see readiness.ts) never reach here -- there is no
 * responsible, unguessed action to name for those.
 */
export async function syncMissingRequirementTasks(
  supabase: Client,
  params: {
    userId: string;
    applicationId: string;
    missingItems: ReadinessItem[];
    officialDeadline: string | null;
    timezone: string;
    titleFor: (item: ReadinessItem) => string;
  },
): Promise<void> {
  const missing = params.missingItems.filter((i) => i.status === "missing");
  if (missing.length === 0) return;

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("title")
    .eq("application_id", params.applicationId)
    .eq("user_id", params.userId);
  const existingTitles = new Set((existingTasks ?? []).map((t) => t.title));

  const dueAt = suggestedPreparationDeadline(params.officialDeadline);

  const toInsert = missing
    .map((item) => params.titleFor(item))
    .filter((title, index, all) => title.trim() !== "" && all.indexOf(title) === index)
    .filter((title) => !existingTitles.has(title));

  if (toInsert.length === 0) return;

  await supabase.from("tasks").insert(
    toInsert.map((title) => ({
      user_id: params.userId,
      application_id: params.applicationId,
      title,
      task_type: "document" as const,
      due_at: dueAt,
      timezone: params.timezone,
      priority: 2,
      completed: false,
    })),
  );
}
