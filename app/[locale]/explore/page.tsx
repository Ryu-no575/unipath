import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import ExploreSearch from "@/app/components/ExploreSearch";

export default async function ExplorePage({
  params,
}: PageProps<"/[locale]/explore">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Explore");
  const cta = await getTranslations("MatchCta");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {t("heading")}
        </h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-zinc-900">{cta("heading")}</h2>
          <p className="text-sm text-zinc-500">{cta("body")}</p>
        </div>
        <Link
          href="/explore/match"
          className="shrink-0 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {cta("button")}
        </Link>
      </div>

      <ExploreSearch />
    </div>
  );
}
