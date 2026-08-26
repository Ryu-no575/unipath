import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { buildCalendarEvents } from "@/app/lib/journey";
import CalendarView from "@/app/components/calendar/CalendarView";
import DevStateError from "@/app/components/DevStateError";

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
  const [applications, { data: tasks }] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    supabase.from("tasks").select("*").eq("user_id", user.id),
  ]);

  const t = await getTranslations("Calendar");
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <CalendarView events={events} userTimezone={profile.timezone} />
    </div>
  );
}
