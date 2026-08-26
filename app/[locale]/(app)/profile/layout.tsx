import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import SiteHeader from "@/app/components/SiteHeader";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getNotificationBellData } from "@/app/lib/data/notifications";

export default async function ProfileLayout({
  children,
  params,
}: LayoutProps<"/[locale]/profile">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getOptionalUser();
  const { unreadCount: unreadNotificationCount, recentNotifications } = user
    ? await getNotificationBellData(await createClient(), user.id)
    : { unreadCount: 0, recentNotifications: [] };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <SiteHeader
        userEmail={user?.email ?? null}
        locale={locale}
        unreadNotificationCount={unreadNotificationCount}
        recentNotifications={recentNotifications}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
