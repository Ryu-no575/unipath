import { hasLocale } from "next-intl";
import { getFormatter, getNow, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getNotificationsForUser } from "@/app/lib/data/notifications";
import DevStateError from "@/app/components/DevStateError";
import MarkAllReadButton from "@/app/components/notifications/MarkAllReadButton";

export default async function NotificationsPage({
  params,
}: PageProps<"/[locale]/notifications">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user } = state;
  const supabase = await createClient();
  const notifications = await getNotificationsForUser(supabase, user.id);

  const t = await getTranslations("Notifications");
  const format = await getFormatter();
  const now = await getNow();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
          <p className="text-sm text-zinc-500">{t("pageSubheading")}</p>
        </div>
        {notifications.some((n) => !n.read) && <MarkAllReadButton locale={locale} />}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          {t("empty")}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={`/notifications/${notification.id}`}
                className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-zinc-50"
              >
                {!notification.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                )}
                <div className={`flex flex-1 flex-col gap-1 ${notification.read ? "pl-5" : ""}`}>
                  <span
                    className={`text-sm ${notification.read ? "text-zinc-600" : "font-medium text-zinc-900"}`}
                  >
                    {notification.title}
                  </span>
                  <span className="text-sm text-zinc-500">{notification.message}</span>
                  <span className="text-xs text-zinc-400">
                    {format.relativeTime(new Date(notification.createdAt), now)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
