import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getUniversityForCommunity, listProgramsForUniversity } from "@/app/lib/data/community";
import NewCommunityPostForm from "@/app/components/community/NewCommunityPostForm";
import PageHeader from "@/app/components/ui/PageHeader";

export default async function NewCommunityPostPage({
  params,
}: PageProps<"/[locale]/universities/[id]/community/new">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getOptionalUser();
  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  const [university, programs] = await Promise.all([
    getUniversityForCommunity(supabase, id),
    listProgramsForUniversity(supabase, id),
  ]);
  if (!university) notFound();

  const t = await getTranslations("Community");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/universities/${id}/community`}
        className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        {t("back")}
      </Link>

      <PageHeader
        title={t("newPostHeading", { university: university.name })}
        description={t("newPostSubheading")}
      />

      <NewCommunityPostForm locale={locale} universityId={id} programs={programs} />
    </div>
  );
}
