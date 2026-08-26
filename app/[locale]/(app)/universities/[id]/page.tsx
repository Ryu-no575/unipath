import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUniversityForCommunity, listProgramsForUniversity } from "@/app/lib/data/community";
import { getRealMatchCandidates } from "@/app/lib/data/match";
import UniversityTabs from "@/app/components/universities/UniversityTabs";
import { Link } from "@/i18n/navigation";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Status from "@/app/components/ui/Status";
import SaveButton from "@/app/components/explore/SaveButton";
import type { SavedUniversityItem } from "@/app/lib/explore/savedUniversities";

export default async function UniversityDetailPage({
  params,
}: PageProps<"/[locale]/universities/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const [university, programs, candidates] = await Promise.all([
    getUniversityForCommunity(supabase, id),
    listProgramsForUniversity(supabase, id),
    getRealMatchCandidates(),
  ]);
  if (!university) notFound();

  const t = await getTranslations("UniversityDetail");
  const location = [university.city, university.countryCode].filter(Boolean).join(", ");

  // Real signal only: "verified" here means at least one of this
  // university's programs has an officialUrlStatus that was actually
  // confirmed reachable (see RealProgramCandidate.verified) -- never a
  // decorative badge with nothing behind it.
  const universityCandidates = candidates.filter((c) => c.universityId === id);
  const isVerified = universityCandidates.some((c) => c.verified);

  const savedItem: SavedUniversityItem = {
    key: `catalog:${id}`,
    name: university.name,
    location: location || null,
    href: `/universities/${id}`,
    external: false,
    savedAt: Date.now(),
  };

  const applyParams = new URLSearchParams({ universityName: university.name });
  if (university.countryCode) applyParams.set("country", university.countryCode);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{university.name}</h1>
            {isVerified && <Status kind="verified" />}
          </div>
          <p className="text-sm text-zinc-500">
            {location || t("locationUnknown")}
            {university.foundedYear ? ` · ${t("founded", { year: university.foundedYear })}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button href={`/applications/new?${applyParams.toString()}`}>
            {t("addToApplications")}
          </Button>
          <div className="w-32">
            <SaveButton item={savedItem} />
          </div>
          <Link
            href={`/routes?university=${id}${programs[0] ? `&program=${programs[0].id}` : ""}`}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {t("viewRoute")}
          </Link>
          {university.officialWebsite && (
            <a
              href={university.officialWebsite}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-sm font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
            >
              {t("officialWebsite")} →
            </a>
          )}
        </div>
      </div>

      <UniversityTabs universityId={id} active="overview" />

      <Card as="section">
        <h2 className="text-base font-semibold text-zinc-900">{t("programsHeading")}</h2>
        {programs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">{t("programsEmpty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
            {programs.map((program) => (
              <li key={program.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-zinc-900">{program.name}</span>
                {program.degreeType && <span className="text-zinc-500">{program.degreeType}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
