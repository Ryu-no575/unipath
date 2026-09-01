import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * The signup wall the guest Match flow ends on (task brief section 3: shown
 * only *after* Landing -> Find My Match -> quiz -> Top 5 Matches -> Route
 * Preview, never before -- see section 5's "no hard login wall"). Signup
 * always goes through onboarding regardless of redirectTo (see
 * signUpAction), which is where the guest's quiz answers get saved -- see
 * OnboardingWizard's sessionStorage prefill (guestSession.ts).
 */
export default function SaveGuestResultsPrompt({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Guest");
  // login's redirectTo is validated against a locale-prefixed pathname (see
  // resolveDestination in app/lib/actions/auth.ts) -- an existing user who
  // logs in from here lands back on Results, now scored against their own
  // saved profile.
  const loginRedirectTo = encodeURIComponent(`/${locale}/explore/match/results`);

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-900">{t("saveHeading")}</h2>
        <p className="text-sm text-zinc-500">{t("saveBody")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("continueWithEmail")}
        </Link>
        <Link
          href={`/login?redirectTo=${loginRedirectTo}`}
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          {t("logIn")}
        </Link>
      </div>
    </div>
  );
}
