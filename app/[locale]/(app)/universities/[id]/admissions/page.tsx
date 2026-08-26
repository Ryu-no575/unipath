import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUniversityForCommunity, listProgramsForUniversity } from "@/app/lib/data/community";
import { getAdmissionRequirementsForCycle } from "@/app/lib/data/passport";
import UniversityTabs from "@/app/components/universities/UniversityTabs";
import Card from "@/app/components/ui/Card";
import EmptyState from "@/app/components/ui/EmptyState";
import Badge from "@/app/components/ui/Badge";

export default async function UniversityAdmissionsPage({
  params,
}: PageProps<"/[locale]/universities/[id]/admissions">) {
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

  // Most recent admission cycle per program, then its official requirement
  // rows -- the same source app/lib/data/passport.ts uses to compute
  // Application Passport readiness, never invented for this page.
  const programCycles = await Promise.all(
    programs.map(async (program) => {
      const { data: cycles } = await supabase
        .from("admission_cycles")
        .select("id, intake_year, intake_season, application_deadline")
        .eq("program_id", program.id)
        .order("application_deadline", { ascending: true, nullsFirst: false })
        .limit(1);
      const cycle = cycles?.[0] ?? null;
      const requirements = cycle ? await getAdmissionRequirementsForCycle(supabase, cycle.id) : [];
      return { program, cycle, requirements };
    }),
  );

  const withRequirements = programCycles.filter((entry) => entry.requirements.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{university.name}</h1>
      </div>

      <UniversityTabs universityId={id} active="admissions" />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{t("admissionsHeading")}</h2>
        {withRequirements.length > 0 && (
          <p className="text-sm text-zinc-500">{t("admissionsSourceNote")}</p>
        )}
      </div>

      {withRequirements.length === 0 ? (
        <EmptyState title={t("admissionsEmpty")} />
      ) : (
        <div className="flex flex-col gap-4">
          {withRequirements.map(({ program, requirements }) => (
            <Card key={program.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-zinc-900">{program.name}</h3>
                {program.degreeType && <span className="text-sm text-zinc-500">{program.degreeType}</span>}
              </div>
              <ul className="flex flex-col divide-y divide-zinc-100">
                {requirements.map((req) => (
                  <li key={req.id} className="flex flex-col gap-1 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">{req.title}</span>
                      {req.required && <Badge tone="neutral">{req.requirement_type}</Badge>}
                    </div>
                    {req.minimum_value && (
                      <span className="text-sm text-zinc-600">{req.minimum_value}</span>
                    )}
                    {req.description && (
                      <span className="text-sm text-zinc-500">{req.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {university.officialWebsite && (
        <a
          href={university.officialWebsite}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="w-fit text-sm font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
        >
          {t("officialSource")} →
        </a>
      )}
    </div>
  );
}
