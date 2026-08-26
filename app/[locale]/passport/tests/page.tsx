import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getTestScores } from "@/app/lib/data/passport";
import DevStateError from "@/app/components/DevStateError";
import TestScoreList from "@/app/components/passport/TestScoreList";

export default async function PassportTestsPage({ params }: PageProps<"/[locale]/passport/tests">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const testScores = await getTestScores(supabase, user.id);

  const t = await getTranslations("PassportTests");
  const englishTestOptions = await getTranslations("EnglishTestOptions");

  const hasPrimary = Boolean(profile.english_test_type && profile.english_test_type !== "none");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/passport" className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        {t("back")}
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">{t("primaryHeading")}</h2>
          <Link href="/profile" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
            {t("editInProfile")}
          </Link>
        </div>
        {hasPrimary ? (
          <p className="text-sm text-zinc-700">
            {englishTestOptions(profile.english_test_type ?? "other")}
            {profile.english_test_score ? ` · ${profile.english_test_score}` : ""}
          </p>
        ) : (
          <p className="text-sm text-zinc-400">{t("primaryEmpty")}</p>
        )}
      </div>

      <TestScoreList locale={locale} testScores={testScores} />
    </div>
  );
}
