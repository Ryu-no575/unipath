import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getUniversityForCommunity, listProgramsForUniversity } from "@/app/lib/data/community";
import NewCommunityPostForm from "@/app/components/community/NewCommunityPostForm";

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

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {t("newPostHeading", { university: university.name })}
        </h1>
        <p className="text-sm text-zinc-500">{t("newPostSubheading")}</p>
      </div>

      <NewCommunityPostForm locale={locale} universityId={id} programs={programs} />
    </div>
  );
}
