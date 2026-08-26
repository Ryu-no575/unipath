import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationWithDetails } from "@/app/lib/data/applications";
import { getSourcesForEntities, getVerifiedFieldsForSources } from "@/app/lib/data/sources";
import {
  getApplicationDocuments,
  getApplicationReadiness,
  getDocumentLinksForUser,
  getTestScores,
} from "@/app/lib/data/passport";
import { syncMissingRequirementTasks } from "@/app/lib/passport/tasks";
import { readinessItemLabel } from "@/app/lib/passport/labels";
import DevStateError from "@/app/components/DevStateError";
import OfficialSources from "@/app/components/updates/OfficialSources";
import VerifiedFields from "@/app/components/updates/VerifiedFields";
import ApplicationStatusBadge from "@/app/components/applications/ApplicationStatusBadge";
import ApplicationStatusSelect from "@/app/components/applications/ApplicationStatusSelect";
import Progress from "@/app/components/ui/Progress";
import DeadlineTime from "@/app/components/DeadlineTime";
import TaskList from "@/app/components/tasks/TaskList";
import RequirementReadiness from "@/app/components/passport/RequirementReadiness";

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-900">{value || "—"}</span>
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: PageProps<"/[locale]/applications/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const application = await getApplicationWithDetails(supabase, user.id, id);
  if (!application) notFound();

  const [sources, documents, testScores, allLinks] = await Promise.all([
    application.isCustomUniversity
      ? Promise.resolve([])
      : getSourcesForEntities(supabase, {
          universityId: application.university?.id ?? null,
          programId: application.program?.id ?? null,
          admissionCycleId: application.admissionCycle?.id ?? null,
        }),
    getApplicationDocuments(supabase, user.id),
    getTestScores(supabase, user.id),
    getDocumentLinksForUser(supabase),
  ]);
  const verifiedFields = await getVerifiedFieldsForSources(
    supabase,
    sources.map((s) => s.id),
  );

  const linkedDocumentIds = new Set(
    allLinks.filter((l) => l.applicationId === application.id).map((l) => l.documentId),
  );
  const readiness = await getApplicationReadiness(supabase, {
    application,
    documents,
    testScores,
    linkedDocumentIds,
    profile: { english_test_type: profile.english_test_type, english_test_score: profile.english_test_score },
  });

  const t = await getTranslations("ApplicationDetail");
  const fields = await getTranslations("Fields");
  const intakeSeasonOptions = await getTranslations("IntakeSeasonOptions");
  const documentTypeT = await getTranslations("DocumentTypeOptions");
  const testTypeT = await getTranslations("TestTypeOptions");
  const passportT = await getTranslations("Passport");

  if (readiness.status === "computed") {
    await syncMissingRequirementTasks(supabase, {
      userId: user.id,
      applicationId: application.id,
      missingItems: readiness.items,
      officialDeadline: application.admissionCycle?.applicationDeadline ?? null,
      timezone: application.admissionCycle?.deadlineTimezone ?? profile.timezone ?? "UTC",
      titleFor: (item) =>
        passportT("suggestedTaskTitle", { label: readinessItemLabel(item, documentTypeT, testTypeT) }),
    });
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("application_id", application.id)
    .eq("user_id", user.id);

  const deadline = application.admissionCycle?.applicationDeadline ?? null;
  const deadlineZone = application.admissionCycle?.deadlineTimezone ?? "UTC";
  const intake = application.admissionCycle
    ? `${intakeSeasonOptions(application.admissionCycle.intakeSeason)} ${application.admissionCycle.intakeYear}`
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/applications"
          className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          {t("back")}
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {!application.isCustomUniversity && application.university?.id ? (
                <Link
                  href={`/universities/${application.university.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {application.university.name}
                </Link>
              ) : (
                (application.university?.name ?? t("unknownUniversity"))
              )}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {application.program?.name}
              {application.university?.countryCode ? ` · ${application.university.countryCode}` : ""}
            </p>
            {!application.isCustomUniversity && application.university?.id && (
              <Link
                href={`/universities/${application.university.id}/community`}
                className="mt-1 inline-block text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
              >
                {t("viewCommunity")}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ApplicationStatusBadge status={application.status} />
            <ApplicationStatusSelect
              key={application.status}
              locale={locale}
              applicationId={application.id}
              status={application.status}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
          <div className="flex flex-col divide-y divide-zinc-100">
            <DetailField label={fields("universityName")} value={application.university?.name} />
            <DetailField label={fields("program")} value={application.program?.name} />
            <DetailField label={fields("degree")} value={application.program?.degreeType} />
            <DetailField label={t("intake")} value={intake} />
          </div>
          <div className="flex flex-col gap-3 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {fields("applicationDeadline")}
            </span>
            {deadline ? (
              <DeadlineTime
                isoInstant={deadline}
                sourceTimezone={deadlineZone}
                userTimezone={profile?.timezone ?? null}
              />
            ) : (
              <span className="text-sm text-zinc-400">{t("noDeadlineYet")}</span>
            )}

            <span className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
              {t("progress")}
            </span>
            <Progress value={application.progress} />
          </div>
        </div>
      </div>

      {!application.isCustomUniversity && (
        <OfficialSources
          sources={sources}
          locale={locale}
          fallbackWebsite={application.university?.officialWebsite ?? null}
        />
      )}
      {!application.isCustomUniversity && <VerifiedFields fields={verifiedFields} />}

      <RequirementReadiness
        readiness={readiness}
        communityHref={
          !application.isCustomUniversity && application.university?.id
            ? `/universities/${application.university.id}/community`
            : null
        }
      />

      <TaskList
        locale={locale}
        applicationId={application.id}
        tasks={tasks ?? []}
        progress={application.progress}
      />
    </div>
  );
}
