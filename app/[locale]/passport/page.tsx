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
import ProgressBar from "@/app/components/ProgressBar";

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
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">{t("emptyHeading")}</h1>
        <p className="text-sm text-zinc-500">
          {t("emptyDescriptionLine1")}
          <br />
          {t("emptyDescriptionLine2")}
        </p>
        <Link
          href="/passport/documents"
          className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("emptyCta")}
        </Link>
      </div>
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">{t("profileCompletionHeading")}</h2>
          <Link href="/profile" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline">
            {t("editProfile")}
          </Link>
        </div>
        <p className="mt-1 text-xs text-zinc-400">{t("profileCompletionDetail")}</p>
        <div className="mt-3">
          <ProgressBar value={profileCompletion} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/passport/education"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-900">{t("educationHeading")}</h2>
          <p className="text-sm text-zinc-500">{t("educationSummaryPrimary")}</p>
          <p className="text-xs text-zinc-400">
            {education.length > 0 ? t("educationSummaryCount", { count: education.length }) : t("educationEmpty")}
          </p>
          <span className="mt-1 text-sm font-medium text-zinc-600">{t("manage")}</span>
        </Link>

        <Link
          href="/passport/tests"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-900">{t("testsHeading")}</h2>
          <p className="text-sm text-zinc-500">{t("testsSummaryPrimary")}</p>
          <p className="text-xs text-zinc-400">
            {testScores.length > 0 ? t("testsSummaryCount", { count: testScores.length }) : t("testsEmpty")}
          </p>
          <span className="mt-1 text-sm font-medium text-zinc-600">{t("manage")}</span>
        </Link>

        <Link
          href="/passport/documents"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-900">{t("documentsHeading")}</h2>
          <p className="text-sm text-zinc-500">
            {documents.length > 0 ? t("documentsReadyCount", { ready: readyDocuments, total: documents.length }) : t("documentsEmpty")}
          </p>
          <span className="mt-1 text-sm font-medium text-zinc-600">{t("manage")}</span>
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {t("nextMissingHeading")}
        </h2>
        {nextMissing ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-zinc-900">{nextMissing.itemTitle}</p>
              <p className="text-sm text-zinc-500">{nextMissing.universityName}</p>
            </div>
            <Link
              href={`/applications/${nextMissing.applicationId}`}
              className="shrink-0 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
            >
              {nextActionT("viewApplication")}
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{t("nextMissingEmpty")}</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          {t("applicationsReadinessHeading")}
        </h2>

        {applications.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("applicationsReadinessEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((application) => {
              const readiness = readinessByApplicationId.get(application.id);
              return (
                <li key={application.id}>
                  <Link
                    href={`/applications/${application.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
                  >
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
                          <ProgressBar value={readiness.scorePercent ?? 0} />
                        </div>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-zinc-400">{readinessT("limitedData")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
