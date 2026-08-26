import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { hasSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the session via the request's cookies so auth state stays in
 * sync with the browser client.
 *
 * Writing cookies from a Server Component (not an Action/Route Handler)
 * throws — that's expected and safe to ignore here, since `proxy.ts` already
 * refreshes the session cookie on every request that needs it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — no-op, see doc comment above.
          }
        },
      },
    },
  );
}

/**
 * Best-effort current user for places that only need it to decide what to
 * *display* (e.g. a header's Login vs. Log out link) — never for an actual
 * authorization decision. Returns null instead of throwing when Supabase
 * isn't configured yet, so public pages that render this (Explore, and
 * Dashboard/Profile's own layouts) don't crash before setup is complete.
 */
export async function getOptionalUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
