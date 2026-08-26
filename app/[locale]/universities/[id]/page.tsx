import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUniversityForCommunity, listProgramsForUniversity } from "@/app/lib/data/community";
import UniversityTabs from "@/app/components/universities/UniversityTabs";
import { Link } from "@/i18n/navigation";

export default async function UniversityDetailPage({
  params,
}: PageProps<"/[locale]/universities/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const [university, programs] = await Promise.all([
    getUniversityForCommunity(supabase, id),
    listProgramsForUniversity(supabase, id),
  ]);
  if (!university) notFound();

  const t = await getTranslations("UniversityDetail");
  const location = [university.city, university.countryCode].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{university.name}</h1>
        <p className="text-sm text-zinc-500">
          {location || t("locationUnknown")}
          {university.foundedYear ? ` · ${t("founded", { year: university.foundedYear })}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {university.officialWebsite && (
            <a
              href={university.officialWebsite}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="w-fit text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
            >
              {t("officialWebsite")} →
            </a>
          )}
          <Link
            href={`/routes?university=${id}${programs[0] ? `&program=${programs[0].id}` : ""}`}
            className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {t("viewRoute")}
          </Link>
        </div>
      </div>

      <UniversityTabs universityId={id} active="overview" />

      <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-zinc-900">{t("programsHeading")}</h2>
        {programs.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("programsEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {programs.map((program) => (
              <li key={program.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-zinc-900">{program.name}</span>
                {program.degreeType && <span className="text-zinc-500">{program.degreeType}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
