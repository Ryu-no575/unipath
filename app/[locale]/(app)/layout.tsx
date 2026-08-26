import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import NavShell from "@/app/components/nav/NavShell";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getNotificationBellData } from "@/app/lib/data/notifications";

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
  const { unreadCount: unreadNotificationCount, recentNotifications } = user
    ? await getNotificationBellData(await createClient(), user.id)
    : { unreadCount: 0, recentNotifications: [] };

  return (
    <NavShell
      userEmail={user?.email ?? null}
      locale={locale}
      unreadNotificationCount={unreadNotificationCount}
      recentNotifications={recentNotifications}
    >
      {children}
    </NavShell>
  );
}
