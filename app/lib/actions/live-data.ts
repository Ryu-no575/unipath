"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { hasServiceRoleEnv } from "@/app/lib/supabase/admin";
import { requireAdmin, AdminAuthError } from "@/app/lib/supabase/roles";
import { simulateChangeForUser } from "@/app/lib/live-data/simulate";
import { checkSource, type CheckSourceResult } from "@/app/lib/live-data/checkSource";
import { runDueValidations, type RunDueValidationsSummary } from "@/app/lib/live-data/scheduler";

export interface SimulateChangeActionResult {
  error?: string;
  changeEventId?: string;
}

/**
 * Dev-only: proves "Simulate Change" writes to Supabase through the real
 * fan-out path rather than faking a change in the UI. Refused outside
 * development even though the button that calls this is itself only
 * rendered in development (see SimulateChangeButton.tsx) -- a Server Action
 * is a public endpoint regardless of which UI links to it.
 */
export async function simulateChangeAction(locale: AppLocale): Promise<SimulateChangeActionResult> {
  if (process.env.NODE_ENV !== "development") {
    return { error: "Simulate Change is only available in development." };
  }
  if (!hasServiceRoleEnv()) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const result = await simulateChangeForUser(user.id);
    revalidatePath(`/${locale}/dashboard`);
    revalidatePath(`/${locale}/notifications`);
    return { changeEventId: result.changeEventId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Simulate Change failed." };
  }
}

export interface CheckSourceActionResult {
  error?: string;
  result?: CheckSourceResult;
}

/**
 * The real "Check Source Now" path: fetches `sources.official_url` for an
 * already-registered source (server-side, SSRF-guarded, robots.txt-checked --
 * see checkSource.ts), diffs it against the last snapshot, and writes any
 * change_events + notifications through the same tables Latest Updates and
 * the Notification Bell already read. Any signed-in user can trigger a check
 * (it never accepts a client-supplied URL, only a sourceId already vetted
 * into `sources`), but checkSource() itself enforces the recheck cooldown so
 * this can't be used to hammer an official site.
 */
export async function checkSourceAction(
  locale: AppLocale,
  sourceId: string,
): Promise<CheckSourceActionResult> {
  if (!hasServiceRoleEnv()) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const result = await checkSource(sourceId);
    if (result.status === "changed") {
      revalidatePath(`/${locale}/dashboard`);
      revalidatePath(`/${locale}/notifications`);
    }
    revalidatePath(`/${locale}/applications`);
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check Source Now failed." };
  }
}

export interface RunDueValidationsActionResult {
  error?: string;
  summary?: RunDueValidationsSummary;
}

/**
 * Admin-only manual trigger for the same batch job a real scheduler would
 * call on a timer (see app/lib/live-data/scheduler.ts and
 * app/api/admin/validate-sources/route.ts) -- lets an admin see Source
 * Health move without waiting for `next_check_due_at` to arrive on its own.
 * Independently re-checks `requireAdmin()` (task brief item 27) -- this is a
 * public Server Action endpoint regardless of which page's button calls it.
 */
export async function runDueValidationsAction(locale: AppLocale): Promise<RunDueValidationsActionResult> {
  if (!hasServiceRoleEnv()) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local." };
  }
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return { error: err.reason === "unauthenticated" ? "Not authenticated." : "Admin role required." };
    }
    return { error: "Admin check failed." };
  }

  try {
    const summary = await runDueValidations(20);
    revalidatePath(`/${locale}/admin`);
    return { summary };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Validation run failed." };
  }
}
