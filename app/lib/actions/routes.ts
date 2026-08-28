"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { ROUTE_TYPES, type RouteType } from "@/app/lib/routes/types";

/** Task brief item 12: persists which Route the user has chosen so
 * Dashboard/Plan/Calendar/Next Action can all agree on it across requests
 * (see app/lib/routes/activeRoute.ts). Never touches Official Deadlines or
 * user-created tasks -- switching routes only changes which *route-derived*
 * suggested dates the Calendar shows (routeCalendarSync.ts recomputes those
 * on every request, nothing to "replace" here). */
export async function setActiveRouteAction(locale: AppLocale, routeType: RouteType): Promise<void> {
  if (!(ROUTE_TYPES as string[]).includes(routeType)) {
    throw new Error(`Unknown route type: ${routeType}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("profiles").update({ active_route_type: routeType }).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/routes`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/plan`);
  revalidatePath(`/${locale}/calendar`);
}

/** Route Decision Engine v2 Capacity Check (task brief item 7): persists how
 * many hours per week the user says they can realistically dedicate to
 * preparation, so app/lib/routes/capacityCheck.ts can compare it against
 * each route's own estimated workload. `null` (the FormData field left
 * blank) explicitly clears it back to "unknown" -- never silently keeps a
 * stale number. */
export async function setWeeklyStudyHoursAction(locale: AppLocale, formData: FormData): Promise<void> {
  const raw = formData.get("weeklyStudyHours");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const hours = trimmed === "" ? null : Number(trimmed);
  if (hours != null && (!Number.isFinite(hours) || hours < 0 || hours > 168)) {
    throw new Error("Weekly study hours must be between 0 and 168.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ weekly_study_hours_available: hours })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/routes`);
}
