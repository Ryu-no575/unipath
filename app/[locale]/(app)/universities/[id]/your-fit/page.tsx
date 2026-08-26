import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getUniversityForCommunity } from "@/app/lib/data/community";
import { getMatchProfileData, getRealMatchCandidates } from "@/app/lib/data/match";
import { computeRealMatches } from "@/app/lib/match/real-engine";
import type { RealMatchReason } from "@/app/lib/match/real-types";
import UniversityTabs from "@/app/components/universities/UniversityTabs";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import { MatchStatus } from "@/app/components/ui/Status";

function reasonKey(kind: RealMatchReason["kind"]): string {
  switch (kind) {
    case "field_positive":
      return "realWhyFieldPositive";
    case "field_caution":
      return "realWhyFieldCaution";
    case "degree_match":
      return "realWhyDegreeMatch";
    case "location_within":
      return "realWhyLocationWithin";
    case "location_outside":
      return "realWhyLocationOutside";
    case "budget_within":
      return "realWhyBudgetWithin";
    case "budget_over":
      return "realWhyBudgetOver";
    case "budget_unknown":
      return "realWhyBudgetUnknown";
    default:
      return "";
  }
}

export default async function UniversityYourFitPage({
  params,
}: PageProps<"/[locale]/universities/[id]/your-fit">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const [university, user] = await Promise.all([
    getUniversityForCommunity(supabase, id),
    getOptionalUser(),
  ]);
  if (!university) notFound();

  const t = await getTranslations("UniversityDetail");
  const matchResultsT = await getTranslations("MatchResults");
  const applicationTypeLabels = await getTranslations("ApplicationTypeOptions");

  let content: React.ReactNode;

  if (!user) {
    content = (
      <EmptyState
        title={t("yourFitSignedOutHeading")}
        description={t("yourFitSignedOutBody")}
        action={<Button href="/explore/match">{t("yourFitCta")}</Button>}
      />
    );
  } else {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileRow) {
      content = (
        <EmptyState
          title={t("yourFitSignedOutHeading")}
          description={t("yourFitSignedOutBody")}
          action={<Button href="/explore/match">{t("yourFitCta")}</Button>}
        />
      );
    } else {
      const [{ profileInputs, destinationCountries }, candidates] = await Promise.all([
        getMatchProfileData(user.id, profileRow),
        getRealMatchCandidates(),
      ]);
      const universityCandidates = candidates.filter((c) => c.universityId === id);
      const computation = computeRealMatches({
        profile: profileInputs,
        destinationCountries,
        candidates: universityCandidates,
      });

      if (universityCandidates.length === 0 || computation.results.length === 0) {
        content = (
          <EmptyState
            title={t("yourFitNoProgramsHeading")}
            description={t("yourFitNoProgramsBody")}
          />
        );
      } else {
        content = (
          <div className="flex flex-col gap-4">
            {computation.results.map((result) => (
              <Card key={result.candidate.programId} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-zinc-900">
                      {result.candidate.programName}
                    </h3>
                    {result.candidate.degreeType && (
                      <p className="text-sm text-zinc-500">
                        {applicationTypeLabels(result.candidate.degreeType)}
                      </p>
                    )}
                  </div>
                  <MatchStatus percent={result.scorePercent} />
                </div>
                <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-4">
                  {result.reasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className={reason.marker === "positive" ? "text-emerald-600" : "text-amber-600"}
                        aria-hidden
                      >
                        {reason.marker === "positive" ? "✓" : "△"}
                      </span>
                      <span className="text-zinc-700">
                        {matchResultsT(reasonKey(reason.kind) as "realWhyFieldPositive")}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{university.name}</h1>
      </div>

      <UniversityTabs universityId={id} active="yourFit" />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{t("yourFitHeading")}</h2>
      </div>

      {content}
    </div>
  );
}
