import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { createAdminClient, hasServiceRoleEnv } from "./admin";
import type { UserRole } from "./database.types";

/**
 * Single source of truth for "is this user an admin". Always reads
 * `user_roles` with the SERVICE ROLE client, never the per-request
 * cookie-authenticated client -- `user_roles` has no RLS policy for
 * anon/authenticated at all (see 20260829000000_admin_roles_v1.sql), so a
 * regular client would always read zero rows regardless of the real answer.
 * The security boundary is entirely server-side: this function only ever
 * runs in server code, and the userId it checks always comes from
 * `supabase.auth.getUser()` (validated against Supabase Auth), never from a
 * client-supplied value.
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  if (!hasServiceRoleEnv()) return "user";
  const admin = createAdminClient();
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return data?.role === "admin" ? "admin" : "user";
}

/** Best-effort admin check for UI decisions only (e.g. showing/hiding the
 * Admin nav link) -- never for gating an actual action. Returns false for a
 * signed-out visitor instead of throwing, so it's safe to call from layouts
 * that render for every user. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return (await getUserRole(user.id)) === "admin";
}

export class AdminAuthError extends Error {
  constructor(public reason: "unauthenticated" | "forbidden") {
    super(reason === "unauthenticated" ? "Not authenticated." : "Admin role required.");
    this.name = "AdminAuthError";
  }
}

/**
 * The one required call at the top of every admin page, Server Action, and
 * Route Handler (see AGENTS.md task notes on Security: "Admin server
 * actions: 必ず authenticated + role === admin をserver-sideで確認"). Never
 * trust a client-supplied role, a cookie, or the fact that a request merely
 * came from an /admin page -- this re-derives the role from `user_roles`
 * every time, via the service-role client, so a normal user can never reach
 * a privileged write path by calling a Server Action directly.
 */
export async function requireAdmin(): Promise<{ user: User; role: "admin" }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AdminAuthError("unauthenticated");

  const role = await getUserRole(user.id);
  if (role !== "admin") throw new AdminAuthError("forbidden");

  return { user, role };
}
