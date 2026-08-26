import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getNotificationDetail } from "@/app/lib/data/notifications";
import { fieldLabel } from "@/app/lib/live-data/field-labels";
import DevStateError from "@/app/components/DevStateError";
import ImportanceBadge from "@/app/components/updates/ImportanceBadge";
import OfficialSourceLink from "@/app/components/updates/OfficialSourceLink";
import NotificationReadMarker from "@/app/components/notifications/NotificationReadMarker";

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-900">{value || "—"}</span>
    </div>
  );
}

export default async function NotificationDetailPage({
  params,
}: PageProps<"/[locale]/notifications/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user } = state;
  const supabase = await createClient();
  const notification = await getNotificationDetail(supabase, user.id, id);
  if (!notification) notFound();

  const t = await getTranslations("Notifications");
  const liveData = await getTranslations("LiveData");
  const reviewStatusT = await getTranslations("ReviewStatus");
  const format = await getFormatter();

  const affectedProgram = [notification.universityName, notification.programName]
    .filter(Boolean)
    .join(" — ") || null;

  return (
    <div className="flex flex-col gap-6">
      {!notification.read && (
        <NotificationReadMarker locale={locale} notificationId={notification.id} />
      )}
      <Link
        href="/notifications"
        className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        {t("back")}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{notification.title}</h1>
          {notification.changeEvent && <ImportanceBadge importance={notification.changeEvent.importance} />}
        </div>
        <p className="text-sm text-zinc-600">{notification.message}</p>
        <p className="text-xs text-zinc-400">
          {format.dateTime(new Date(notification.createdAt), { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      {notification.communityPostId && notification.communityUniversityId && (
        <Link
          href={`/universities/${notification.communityUniversityId}/community/${notification.communityPostId}`}
          className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("viewDiscussion")}
        </Link>
      )}

      {notification.changeEvent && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
            <div className="flex flex-col divide-y divide-zinc-100">
              <DetailField label={liveData("affectedProgram")} value={affectedProgram} />
              <DetailField
                label={liveData("changedField")}
                value={fieldLabel(notification.changeEvent.fieldName)}
              />
              <DetailField
                label={liveData("detectedAt")}
                value={format.dateTime(new Date(notification.changeEvent.detectedAt), { dateStyle: "long", timeStyle: "short" })}
              />
              <DetailField
                label={liveData("reviewStatus")}
                value={reviewStatusT(notification.changeEvent.reviewStatus)}
              />
            </div>
            <div className="flex flex-col divide-y divide-zinc-100">
              <DetailField label={liveData("oldValue")} value={notification.changeEvent.oldValue} />
              <DetailField label={liveData("newValue")} value={notification.changeEvent.newValue} />
            </div>
          </div>
          <div className="mt-2 border-t border-zinc-100 pt-4">
            <OfficialSourceLink url={notification.officialUrl} publisher={notification.sourcePublisher} />
          </div>
        </div>
      )}
    </div>
  );
}
