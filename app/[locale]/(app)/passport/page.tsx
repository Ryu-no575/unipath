import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import {
  getApplicationDocuments,
  getDocumentLinksForUser,
  getEducationHistory,
  getReadinessForApplications,
  getTestScores,
  syncReadinessTasksForApplications,
} from "@/app/lib/data/passport";
import { computeProfileCompletionPercent } from "@/app/lib/passport/readiness";
import { readinessItemLabel } from "@/app/lib/passport/labels";
import DevStateError from "@/app/components/DevStateError";
import Progress from "@/app/components/ui/Progress";
import PageHeader from "@/app/components/ui/PageHeader";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Card from "@/app/components/ui/Card";
import EmptyState from "@/app/components/ui/EmptyState";

export default async function PassportPage({ params }: PageProps<"/[locale]/passport">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();

  const [applications, education, testScores, documents, links] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    getEducationHistory(supabase, user.id),
    getTestScores(supabase, user.id),
    getApplicationDocuments(supabase, user.id),
    getDocumentLinksForUser(supabase),
  ]);

  const readinessList = await getReadinessForApplications(supabase, {
    applications,
    documents,
    testScores,
    links,
    profile: { english_test_type: profile.english_test_type, english_test_score: profile.english_test_score },
  });
  const readinessByApplicationId = new Map(readinessList.map((r) => [r.applicationId, r]));

  const t = await getTranslations("Passport");
  const readinessT = await getTranslations("Readiness");
  const applicationsT = await getTranslations("Applications");
  const nextActionT = await getTranslations("NextAction");
  const documentTypeT = await getTranslations("DocumentTypeOptions");
  const testTypeT = await getTranslations("TestTypeOptions");
  const planT = await getTranslations("Plan");

  await syncReadinessTasksForApplications(supabase, {
    userId: user.id,
    applications,
    documents,
    testScores,
    links,
    profile: { english_test_type: profile.english_test_type, english_test_score: profile.english_test_score },
    fallbackTimezone: profile.timezone ?? "UTC",
    titleFor: (item) => t("suggestedTaskTitle", { label: readinessItemLabel(item, documentTypeT, testTypeT) }),
  });

  const isFullyEmpty =
    education.length === 0 && testScores.length === 0 && documents.length === 0 && applications.length === 0;

  if (isFullyEmpty) {
    return (
      <EmptyState
        title={t("emptyHeading")}
        description={
          <>
            {t("emptyDescriptionLine1")}
            <br />
            {t("emptyDescriptionLine2")}
          </>
        }
        action={
          <Link
            href="/passport/documents"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {t("emptyCta")}
          </Link>
        }
      />
    );
  }

  const profileCompletion = computeProfileCompletionPercent(profile);
  const readyDocuments = documents.filter((d) => d.status === "ready" || d.status === "submitted").length;

  const missingCandidates = applications.flatMap((application) => {
    const readiness = readinessByApplicationId.get(application.id);
    if (!readiness || readiness.status !== "computed") return [];
    return readiness.items
      .filter((item) => item.status === "missing")
      .map((item) => ({
        applicationId: application.id,
        universityName: application.university?.name ?? applicationsT("unknownUniversity"),
        itemTitle: item.title,
        deadline: application.admissionCycle?.applicationDeadline ?? null,
      }));
  });
  missingCandidates.sort((a, b) => {
    const aDue = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
  const nextMissing = missingCandidates[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      {/* Hero: profile completion + next missing item, combined into one
          clear focal point instead of two equally-weighted cards. */}
      <Card padding="lg" className="flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">{t("profileCompletionHeading")}</h2>
            <Link href="/profile" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
              {t("editProfile")}
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-400">{t("profileCompletionDetail")}</p>
          <div className="mt-3">
            <Progress value={profileCompletion} />
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {t("nextMissingHeading")}
          </h3>
          {nextMissing ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-zinc-900">{nextMissing.itemTitle}</p>
                <p className="text-sm text-zinc-500">{nextMissing.universityName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <Link
                  href={`/applications/${nextMissing.applicationId}`}
                  className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
                >
                  {nextActionT("viewApplication")}
                </Link>
                <Link
                  href="/plan"
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-900 hover:underline"
                >
                  {planT("heading")} →
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">{t("nextMissingEmpty")}</p>
          )}
        </div>
      </Card>

      {/* Secondary: Education / Tests / Documents -- clearly quieter than the hero above. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card as={Link} href="/passport/education" interactive padding="sm" className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-zinc-900">{t("educationHeading")}</h2>
          <p className="text-xs text-zinc-400">
            {education.length > 0 ? t("educationSummaryCount", { count: education.length }) : t("educationEmpty")}
          </p>
          <span className="mt-1 text-sm font-medium text-zinc-600">{t("manage")}</span>
        </Card>

        <Card as={Link} href="/passport/tests" interactive padding="sm" className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-zinc-900">{t("testsHeading")}</h2>
          <p className="text-xs text-zinc-400">
            {testScores.length > 0 ? t("testsSummaryCount", { count: testScores.length }) : t("testsEmpty")}
          </p>
          <span className="mt-1 text-sm font-medium text-zinc-600">{t("manage")}</span>
        </Card>

        <Card as={Link} href="/passport/documents" interactive padding="sm" className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-zinc-900">{t("documentsHeading")}</h2>
          <p className="text-xs text-zinc-400">
            {documents.length > 0 ? t("documentsReadyCount", { ready: readyDocuments, total: documents.length }) : t("documentsEmpty")}
          </p>
          <span className="mt-1 text-sm font-medium text-zinc-600">{t("manage")}</span>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeader title={t("applicationsReadinessHeading")} />

        {applications.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("applicationsReadinessEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((application) => {
              const readiness = readinessByApplicationId.get(application.id);
              return (
                <li key={application.id}>
                  <Card as={Link} href={`/applications/${application.id}`} interactive padding="sm" className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {application.university?.name ?? applicationsT("unknownUniversity")}
                      </p>
                      <p className="text-xs text-zinc-500">{application.program?.name}</p>
                    </div>
                    {readiness && readiness.status === "computed" ? (
                      <div className="flex w-32 shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-zinc-900">{readiness.scorePercent}%</span>
                        <div className="w-full">
                          <Progress value={readiness.scorePercent ?? 0} />
                        </div>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-zinc-400">{readinessT("limitedData")}</span>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
