"use server";

import { redirect } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";

export interface AuthFormState {
  error?: "missingFields" | "invalidCredentials" | "checkEmail" | "generic";
}

function readCredentials(formData: FormData): { email: string; password: string } | null {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return null;
  return { email, password };
}

/**
 * `redirectTo` is attacker-controlled input (a query param on /login and
 * /signup — see those pages). It's expected to be the full, locale-prefixed
 * pathname `proxy.ts` captured (e.g. "/ja/dashboard"), so we only accept it
 * if it's same-origin (starts with a single "/") AND actually locale-prefixed
 * — anything else (a bare "/profile", "//evil.com", an absolute URL) falls
 * back to the locale-prefixed default instead.
 */
function resolveDestination(
  locale: AppLocale,
  redirectTo: string | undefined,
  fallbackPath: string,
): string {
  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    const firstSegment = redirectTo.split("/")[1];
    if ((routing.locales as readonly string[]).includes(firstSegment)) {
      return redirectTo;
    }
  }
  return `/${locale}${fallbackPath}`;
}

export async function signUpAction(
  locale: AppLocale,
  _redirectTo: string | undefined,
  _prevState: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: "missingFields" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) return { error: "generic" };

  // Email confirmation is on by default for new Supabase projects — in that
  // case there's no session yet, so send the user to check their inbox
  // instead of a protected page.
  if (!data.session) return { error: "checkEmail" };

  // Every new user goes through onboarding first, regardless of where they
  // were trying to go — there's no profile to act on yet.
  redirect(`/${locale}/onboarding`);
}

export async function logInAction(
  locale: AppLocale,
  redirectTo: string | undefined,
  _prevState: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: "missingFields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) return { error: "invalidCredentials" };

  // getUserState() (not a one-off query here) so this destination decision
  // can never drift out of sync with what the destination page itself
  // decides — that drift is exactly what causes onboarding <-> dashboard
  // redirect loops.
  const state = await getUserState();
  const destination =
    state.status === "ready"
      ? resolveDestination(locale, redirectTo, "/dashboard")
      : `/${locale}/onboarding`;

  redirect(destination);
}

export async function logOutAction(locale: AppLocale) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
