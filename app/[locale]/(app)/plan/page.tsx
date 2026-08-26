import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { getApplicationDocuments } from "@/app/lib/data/passport";
import { computeProfileCompletionPercent } from "@/app/lib/passport/readiness";
import { getRouteEngineInput } from "@/app/lib/data/routes";
import { generateRoute } from "@/app/lib/routes/generateRoute";
import { routeStepLabel } from "@/app/lib/routes/labels";
import DevStateError from "@/app/components/DevStateError";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import { PlanIcon } from "@/app/components/nav/icons";

export default async function PlanOverviewPage({ params }: PageProps<"/[locale]/plan">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const [applications, documents, routeInput, { data: tasks }] = await Promise.all([
    getApplicationsWithDetails(supabase, user.id),
    getApplicationDocuments(supabase, user.id),
    getRouteEngineInput(supabase, user.id, profile),
    supabase.from("tasks").select("*").eq("user_id", user.id),
  ]);

  const route = generateRoute(routeInput, "balanced");
  const t = await getTranslations("Plan");
  const stepTypes = await getTranslations("RouteStepTypeOptions");
  const stepDetails = await getTranslations("RouteStepDetails");
  const documentTypes = await getTranslations("DocumentTypeOptions");
  const applicationsT = await getTranslations("Applications");

  const currentStep = route.currentStep;
  const currentStepLabel = currentStep
    ? routeStepLabel(currentStep, { stepTypes, stepDetails, documentTypes: (key) => documentTypes(key) })
    : null;

  const linkedApplication = currentStep?.applicationId
    ? (applications.find((a) => a.id === currentStep.applicationId) ?? null)
    : null;
  const linkedTask = currentStep?.taskId
    ? ((tasks ?? []).find((task) => task.id === currentStep.taskId) ?? null)
    : null;

  const completedSteps = route.steps.filter((s) => s.status === "done").length;
  const activeApplications = applications.filter((a) => a.status !== "considering" && a.status !== "withdrawn" && a.status !== "rejected").length;
  const readyDocuments = documents.filter((d) => d.status === "ready" || d.status === "submitted").length;
  const profileCompletion = computeProfileCompletionPercent(profile);
  const upcomingTasks = (tasks ?? []).filter((task) => !task.completed && task.due_at).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("heading")} description={t("subheading")} />

      {currentStepLabel ? (
        <Card>
          <SectionHeader title={t("chainHeading")} />
          <div className="mt-4 flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
            <ChainNode
              icon="●"
              label={t("chainRouteStepLabel")}
              title={currentStepLabel.title}
              href="/routes"
            />
            <ChainConnector />
            <ChainNode
              icon="◆"
              label={t("chainPassportLabel")}
              title={
                linkedApplication
                  ? (linkedApplication.university?.name ?? applicationsT("unknownUniversity"))
                  : null
              }
              href="/passport"
            />
            <ChainConnector />
            <ChainNode
              icon="▲"
              label={t("chainTaskLabel")}
              title={linkedTask?.title ?? null}
              href="/applications"
            />
            <ChainConnector />
            <ChainNode
              icon="■"
              label={t("chainCalendarLabel")}
              title={
                linkedTask?.due_at
                  ? new Date(linkedTask.due_at).toLocaleDateString(locale, { month: "short", day: "numeric" })
                  : null
              }
              href="/calendar"
              last
            />
          </div>
        </Card>
      ) : (
        <EmptyState title={t("chainEmpty")} action={<Button href="/profile">{t("emptyCta")}</Button>} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PlanSummaryCard
          icon={<PlanIcon />}
          label={t("tabRoute")}
          value={`${completedSteps}/${route.steps.length}`}
          href="/routes"
          cta={t("viewRoute")}
        />
        <PlanSummaryCard
          label={t("tabApplications")}
          value={String(activeApplications)}
          href="/applications"
          cta={t("viewApplications")}
        />
        <PlanSummaryCard
          label={t("tabPassport")}
          value={`${profileCompletion}% · ${readyDocuments}/${documents.length || 0}`}
          href="/passport"
          cta={t("viewPassport")}
        />
        <PlanSummaryCard
          label={t("tabCalendar")}
          value={String(upcomingTasks)}
          href="/calendar"
          cta={t("viewCalendar")}
        />
      </div>
    </div>
  );
}

function ChainNode({
  icon,
  label,
  title,
  href,
  last = false,
}: {
  icon: string;
  label: string;
  title: string | null;
  href: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col gap-1 px-4 py-3 transition-colors hover:bg-zinc-50 ${
        last ? "" : "sm:border-r sm:border-zinc-100"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        <span aria-hidden>{icon}</span>
        {label}
      </span>
      <span className={`text-sm font-medium ${title ? "text-zinc-900" : "text-zinc-400"}`}>
        {title ?? "—"}
      </span>
    </Link>
  );
}

function ChainConnector() {
  return (
    <div className="hidden items-center px-1 text-zinc-300 sm:flex" aria-hidden>
      →
    </div>
  );
}

function PlanSummaryCard({
  icon,
  label,
  value,
  href,
  cta,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  href: string;
  cta: string;
}) {
  return (
    <Card interactive as={Link} href={href} className="flex flex-col gap-2">
      {icon && <span className="text-zinc-400">{icon}</span>}
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-2xl font-semibold text-zinc-900">{value}</span>
      <span className="mt-1 text-sm font-medium text-zinc-600">{cta} →</span>
    </Card>
  );
}
