import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { hasSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase auth session for `proxy.ts`. Must run on every
 * request that might touch a protected route so expired access tokens get
 * renewed before Server Components read the session.
 *
 * `response` is the NextResponse the caller already built (e.g. from
 * next-intl's middleware) — we mutate its cookies in place rather than
 * constructing a fresh one, so we don't clobber next-intl's locale cookie
 * or rewrite headers.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  if (!hasSupabaseEnv()) {
    // Supabase isn't configured yet (see .env.example) — treat every
    // request as signed-out instead of crashing every route.
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) validates the token against Supabase Auth
  // rather than just trusting the cookie — required for a security check.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
