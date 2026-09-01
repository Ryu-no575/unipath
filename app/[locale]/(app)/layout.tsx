import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import NavShell from "@/app/components/nav/NavShell";
import FeedbackWidget from "@/app/components/feedback/FeedbackWidget";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getUserRole } from "@/app/lib/supabase/roles";
import { getNotificationBellData } from "@/app/lib/data/notifications";
import type { AppLocale } from "@/i18n/routing";

export default async function AppShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getOptionalUser();
  const [{ unreadCount: unreadNotificationCount, recentNotifications }, isAdmin] = await Promise.all([
    user ? getNotificationBellData(await createClient(), user.id) : Promise.resolve({ unreadCount: 0, recentNotifications: [] }),
    user ? getUserRole(user.id).then((role) => role === "admin") : Promise.resolve(false),
  ]);

  return (
    <>
      <NavShell
        userEmail={user?.email ?? null}
        locale={locale}
        unreadNotificationCount={unreadNotificationCount}
        recentNotifications={recentNotifications}
        isAdmin={isAdmin}
      >
        {children}
      </NavShell>
      <FeedbackWidget locale={locale as AppLocale} />
    </>
  );
}
