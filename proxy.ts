import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./app/lib/supabase/middleware";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`; next-intl's middleware
// factory still returns a plain (req) => res function, so it plugs in as-is.
const intlMiddleware = createMiddleware(routing);

// Route segments (locale-stripped) that require a signed-in user.
const PROTECTED_SEGMENTS = ["dashboard", "profile", "onboarding"];

// /dashboard/university/[id] lives under the "dashboard" segment for
// historical/URL-structure reasons, but University Detail must stay public
// per spec — same as Landing and Explore — so it's carved out here rather
// than moved, to avoid touching its (working, static-generated) route.
const PUBLIC_EXCEPTIONS = [/^\/dashboard\/university(\/|$)/];

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    return "/" + segments.slice(2).join("/");
  }
  return pathname;
}

function isProtectedPath(pathname: string): boolean {
  const path = stripLocale(pathname);
  if (PUBLIC_EXCEPTIONS.some((pattern) => pattern.test(path))) return false;
  return PROTECTED_SEGMENTS.some(
    (segment) => path === `/${segment}` || path.startsWith(`/${segment}/`),
  );
}

export default async function proxy(request: NextRequest) {
  // Run next-intl first so locale detection/redirects/rewrites happen, then
  // layer the Supabase session refresh on top of that same response so we
  // don't clobber next-intl's cookies or rewritten URL.
  const intlResponse = intlMiddleware(request);
  const { response, user } = await updateSession(request, intlResponse);

  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const maybeLocale = request.nextUrl.pathname.split("/")[1];
    const locale = (routing.locales as readonly string[]).includes(maybeLocale)
      ? maybeLocale
      : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
