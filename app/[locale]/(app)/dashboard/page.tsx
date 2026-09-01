import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { getLatestUpdatesForUser } from "@/app/lib/data/live-updates";
import {
  getApplicationDocuments,
  getDocumentLinksForUser,
  getTestScores,
  syncReadinessTasksForApplications,
} from "@/app/lib/data/passport";
import { readinessItemLabel } from "@/app/lib/passport/labels";
import { buildCalendarEvents, deriveLateJourneyStatuses, resolveNextActionFallbackStep, selectNextAction } from "@/app/lib/journey";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateRoute } from "@/app/lib/routes/generateRoute";
import { getActiveRouteType } from "@/app/lib/routes/activeRoute";
import { routeStepHref, routeStepLabel } from "@/app/lib/routes/labels";
import type { JourneyStep } from "@/app/components/JourneyProgress";
import NextActionCard from "@/app/components/NextActionCard";
import UpcomingDeadlines from "@/app/components/UpcomingDeadlines";
import LatestUpdates from "@/app/components/updates/LatestUpdates";
import SimulateChangeButton from "@/app/components/updates/SimulateChangeButton";
import JourneyProgress from "@/app/components/JourneyProgress";
import ApplicationsList from "@/app/components/applications/ApplicationsList";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";

export default async function DashboardPage({
  params,
}: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const [applications, latestUpdates, documents, testScores, links, routeInput] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    getLatestUpdatesForUser(supabase, user.id),
    getApplicationDocuments(supabase, user.id),
    getTestScores(supabase, user.id),
    getDocumentLinksForUser(supabase),
    getRouteEngineInput(supabase, user.id, profile),
  ]);
  const activeRoute = generateRoute(routeInput, getActiveRouteType(profile));

  const t = await getTranslations("Dashboard");
  const applicationsT = await getTranslations("Applications");
  const documentTypeT = await getTranslations("DocumentTypeOptions");
  const testTypeT = await getTranslations("TestTypeOptions");
  const passportT = await getTranslations("Passport");
  const stepTypesT = await getTranslations("RouteStepTypeOptions");
  const stepDetailsT = await getTranslations("RouteStepDetails");
  const matchCtaT = await getTranslations("MatchCta");

  await syncReadinessTasksForApplications(supabase, {
    userId: user.id,
    applications,
    documents,
    testScores,
    links,
    profile: { english_test_type: profile.english_test_type, english_test_score: profile.english_test_score },
    fallbackTimezone: profile.timezone ?? "UTC",
    titleFor: (item) =>
      passportT("suggestedTaskTitle", { label: readinessItemLabel(item, documentTypeT, testTypeT) }),
  });

  const { data: tasks } = await supabase.from("tasks").select("*").eq("user_id", user.id);

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const incompleteTasks = (tasks ?? []).filter((task) => !task.completed);

  const nextTask = selectNextAction(
    incompleteTasks.map((task) => ({
      id: task.id,
      title: task.title,
      taskType: task.task_type,
      dueAt: task.due_at,
      timezone: task.timezone,
      priority: task.priority,
      applicationId: task.application_id,
      completed: task.completed,
    })),
  );
  const nextTaskApplication = nextTask?.applicationId
    ? (applicationById.get(nextTask.applicationId) ?? null)
    : null;

  const events = buildCalendarEvents(
    (tasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      taskType: task.task_type,
      dueAt: task.due_at,
      timezone: task.timezone,
      completed: task.completed,
      priority: task.priority,
      applicationId: task.application_id,
    })),
    applications,
    applicationsT("unknownUniversity"),
  );

  const consideringCount = applications.filter((a) => a.status === "considering").length;
  const activeApplicationsCount = applications.filter(
    (a) => a.status !== "considering" && a.status !== "withdrawn" && a.status !== "rejected",
  ).length;

  const lateStatuses = deriveLateJourneyStatuses(activeRoute);

  const journeySteps: JourneyStep[] = [
    {
      key: "profile",
      status: "done",
      href: `/profile`,
    },
    {
      key: "explore",
      status: "available",
      href: `/explore`,
    },
    {
      key: "shortlist",
      status: consideringCount > 0 ? "inProgress" : "notStarted",
      href: `/applications`,
      detail:
        consideringCount > 0
          ? t("shortlistDetail", { count: consideringCount })
          : undefined,
    },
    {
      key: "applications",
      status: applications.length > 0 ? "inProgress" : "notStarted",
      href: `/applications`,
      detail:
        applications.length > 0
          ? t("applicationsDetail", { count: activeApplicationsCount })
          : undefined,
    },
    { key: "funding", status: lateStatuses.funding, href: lateStatuses.funding === "comingLater" ? null : "/applications" },
    { key: "visa", status: lateStatuses.visa, href: lateStatuses.visa === "comingLater" ? null : "/plan/visa" },
    { key: "move", status: lateStatuses.move, href: lateStatuses.move === "comingLater" ? null : "/plan/housing" },
    { key: "arrival", status: lateStatuses.arrival, href: lateStatuses.arrival === "comingLater" ? null : "/plan/arrival" },
  ];

  const currentStepLabel = activeRoute.currentStep
    ? routeStepLabel(activeRoute.currentStep, {
        stepTypes: stepTypesT,
        stepDetails: stepDetailsT,
        documentTypes: (key) => documentTypeT(key),
      })
    : null;

  const fallbackStep = nextTask ? null : resolveNextActionFallbackStep(activeRoute, profile.self_reported_stage);
  const nextActionFallback =
    fallbackStep && fallbackStep.fromSelfReport
      ? {
          title: stepTypesT(fallbackStep.type),
          detail: t("selfReportedFallbackDetail"),
          href: routeStepHref(fallbackStep.type),
          dueAt: null,
        }
      : fallbackStep && activeRoute.currentStep
        ? {
            title: currentStepLabel!.title,
            detail: currentStepLabel!.detail,
            href: routeStepHref(activeRoute.currentStep.type),
            dueAt: activeRoute.currentStep.date?.suggestedDate ?? activeRoute.currentStep.date?.officialDate ?? null,
          }
        : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      {/* 1. Next Action */}
      <NextActionCard
        locale={locale}
        task={
          nextTask
            ? {
                id: nextTask.id,
                title: nextTask.title,
                taskType: nextTask.taskType,
                dueAt: nextTask.dueAt,
                applicationId: nextTask.applicationId,
                universityName: nextTaskApplication?.university?.name ?? null,
              }
            : null
        }
        fallback={nextActionFallback}
      />

      {/* 2. Your Journey / Current Route -- one rail, links straight into Plan */}
      <JourneyProgress
        steps={journeySteps}
        routeHref="/routes"
        routeDetail={currentStepLabel?.title}
      />

      {/* 3. Upcoming Deadlines */}
      <UpcomingDeadlines events={events} />

      {/* 4. Applications */}
      <div className="flex flex-col gap-4">
        <SectionHeader title={t("applicationsHeading")} />
        <ApplicationsList applications={applications} userTimezone={profile.timezone} />
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="flex justify-end">
          <SimulateChangeButton locale={locale} />
        </div>
      )}

      {/* 5. Latest Updates */}
      <LatestUpdates items={latestUpdates} />

      {/* 6. Recommended / Match -- lowest priority, last on the page */}
      <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <SectionHeader title={matchCtaT("heading")} />
          <p className="text-sm text-zinc-500">{matchCtaT("body")}</p>
        </div>
        <Button href="/explore/match" variant="secondary" className="shrink-0">
          {matchCtaT("button")}
        </Button>
      </Card>
    </div>
  );
}
