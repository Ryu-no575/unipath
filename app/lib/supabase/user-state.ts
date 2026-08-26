import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import type { Database } from "./database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Single source of truth for "where should this signed-in user land".
 * Every protected page/layout must derive its redirect decision from this
 * (not re-implement its own profile fetch + onboarding_completed check) so
 * the onboarding <-> dashboard redirect rules can't drift out of sync and
 * bounce a user back and forth between the two.
 *
 * `profiles.user_id` (not `profiles.id`) is the only supported link back to
 * `auth.users.id` — every query here and in callers must use it.
 */
export type UserState =
  | { status: "unauthenticated" }
  | { status: "needs_onboarding"; user: User; profile: Profile | null }
  | { status: "ready"; user: User; profile: Profile }
  // The profiles query itself failed (network/DB error) — distinct from
  // "no profile row yet". Callers must surface this, not redirect on it:
  // treating a transient read failure as "needs onboarding" is what turns a
  // blip into a dashboard <-> onboarding redirect loop.
  | { status: "error"; user: User; message: string };

export async function getUserState(): Promise<UserState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "unauthenticated" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { status: "error", user, message: error.message };

  if (!profile || !profile.onboarding_completed) {
    return { status: "needs_onboarding", user, profile: profile ?? null };
  }

  return { status: "ready", user, profile };
}
