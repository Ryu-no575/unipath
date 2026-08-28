import type { Database } from "@/app/lib/supabase/database.types";
import { ROUTE_TYPES, type RouteType } from "./types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const DEFAULT_ROUTE_TYPE: RouteType = "balanced";

function isRouteType(value: string): value is RouteType {
  return (ROUTE_TYPES as string[]).includes(value);
}

/** The single source of truth for "which route is this user actually on" --
 * Dashboard, Plan, Calendar, and Next Action must all call this rather than
 * hardcoding a route (task brief item 12/14). Defaults to Balanced only when
 * the user has never used the "Use this route" action, or the stored value
 * is somehow stale/invalid -- never throws on bad data. */
export function getActiveRouteType(profile: Pick<ProfileRow, "active_route_type">): RouteType {
  const stored = profile.active_route_type;
  if (stored && isRouteType(stored)) return stored;
  return DEFAULT_ROUTE_TYPE;
}
