import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { buildCalendarEvents } from "@/app/lib/journey";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateRoute } from "@/app/lib/routes/generateRoute";
import { getActiveRouteType } from "@/app/lib/routes/activeRoute";
import { buildRouteSuggestedEvents } from "@/app/lib/routes/routeCalendarSync";
import CalendarView from "@/app/components/calendar/CalendarView";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";

export default async function CalendarPage({ params }: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const [applications, { data: tasks }, routeInput] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    supabase.from("tasks").select("*").eq("user_id", user.id),
    getRouteEngineInput(supabase, user.id, profile),
  ]);

  const t = await getTranslations("Calendar");
  const stepTypesT = await getTranslations("RouteStepTypeOptions");
  const unknownUniversityLabel = await getTranslations("Applications").then((apps) =>
    apps("unknownUniversity"),
  );

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
    unknownUniversityLabel,
  );

  // Task brief item 11 (mandatory): the active Route's own backward-planned
  // suggested dates appear on the Calendar, clearly tagged "UniPath
  // Suggested" (see CalendarView/TimelineView/MonthView). Switching routes
  // (app/lib/actions/routes.ts) changes only these -- never a real
  // user-created task, never an Official Deadline.
  const activeRoute = generateRoute(routeInput, getActiveRouteType(profile));
  const routeEvents = buildRouteSuggestedEvents(activeRoute, (type) => stepTypesT(type));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      <CalendarView events={[...events, ...routeEvents]} userTimezone={profile.timezone} />
    </div>
  );
}
