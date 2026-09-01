import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getUserRole } from "@/app/lib/supabase/roles";
import DevStateError from "@/app/components/DevStateError";
import AdminNav from "@/app/components/admin/AdminNav";

/**
 * The one gate every /admin/* route runs through (task brief item 4/27):
 * unauthenticated -> /login, authenticated but role !== "admin" -> /dashboard
 * (never a bare 404/500 -- see the task brief's "403 または Dashboardへredirect",
 * choosing the redirect option for a clearer UX), and role is always
 * re-derived server-side from `user_roles` via the service-role client (see
 * app/lib/supabase/roles.ts) -- never trusted from a cookie, a client prop,
 * or the mere fact that this layout rendered before.
 *
 * This protects every /admin *page* render. It does NOT protect the Server
 * Actions those pages call (approve/reject/verify/...) -- those are
 * independently reachable endpoints, so each one calls requireAdmin() itself
 * (see app/lib/actions/admin.ts).
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const role = await getUserRole(state.user.id);
  if (role !== "admin") redirect(`/${locale}/dashboard`);

  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-6">
      <AdminNav
        locale={locale}
        heading={t("heading")}
        navDashboard={t("navDashboard")}
        navUniversities={t("navUniversities")}
        navPrograms={t("navPrograms")}
        navSources={t("navSources")}
        navChanges={t("navChanges")}
        navCommunity={t("navCommunity")}
        navPriorities={t("navPriorities")}
        navVisa={t("navVisa")}
        navFeedback={t("navFeedback")}
      />
      {children}
    </div>
  );
}
