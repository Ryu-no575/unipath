import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getOptionalUser } from "@/app/lib/supabase/server";
import ExploreSearch from "@/app/components/ExploreSearch";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Button from "@/app/components/ui/Button";

export default async function ExplorePage({
  params,
}: PageProps<"/[locale]/explore">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Explore");
  const cta = await getTranslations("MatchCta");
  const user = await getOptionalUser();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      <Card
        padding="sm"
        className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div className="flex flex-col gap-0.5">
          <SectionHeader title={cta("heading")} />
          <p className="text-sm text-zinc-500">{cta("body")}</p>
        </div>
        <Button href="/explore/match" variant="secondary" className="shrink-0">
          {cta("button")}
        </Button>
      </Card>

      <ExploreSearch loggedIn={Boolean(user)} />
    </div>
  );
}
