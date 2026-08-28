import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { listAdminCommunityReports, listRequestedUniversities } from "@/app/lib/data/adminCommunity";
import { resolveReportAction, dismissReportAction } from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge, { type BadgeTone } from "@/app/components/ui/Badge";
import AdminActionButton from "@/app/components/admin/AdminActionButton";
import type { CommunityReportStatus } from "@/app/lib/supabase/database.types";

export default async function AdminCommunityPage({ params }: PageProps<"/[locale]/admin/community">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const t = await getTranslations("AdminCommunity");
  // Reads via the service-role client, not the per-request cookie client:
  // community_reports and user_custom_universities are RLS'd to
  // select-own-only (see 20260826260000_community_v1.sql and
  // 20260826180000_canonical_university_model.sql), so an admin needs every
  // user's rows here, not just their own. Safe only because this render path
  // is already gated to role === "admin" by admin/layout.tsx before this
  // page ever runs.
  const admin = createAdminClient();
  const [reports, requested] = await Promise.all([
    listAdminCommunityReports(admin),
    listRequestedUniversities(admin),
  ]);

  const pendingReports = reports.filter((r) => r.status === "pending");
  const statusLabel: Record<CommunityReportStatus, string> = {
    pending: t("reportStatusPending"),
    reviewed: t("reportStatusReviewed"),
    resolved: t("reportStatusResolved"),
    dismissed: t("reportStatusDismissed"),
  };
  const statusTone: Record<CommunityReportStatus, BadgeTone> = {
    pending: "warning",
    reviewed: "info",
    resolved: "success",
    dismissed: "neutral",
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("reportsHeading")}</h3>
        <Card padding="none" className="overflow-x-auto">
          {pendingReports.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">{t("empty")}</p>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("columnReporter")}</th>
                  <th className="px-4 py-3 font-medium">{t("columnContent")}</th>
                  <th className="px-4 py-3 font-medium">{t("columnReason")}</th>
                  <th className="px-4 py-3 font-medium">{t("columnStatus")}</th>
                  <th className="px-4 py-3 font-medium">{t("columnReported")}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pendingReports.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-zinc-600">{r.reporterDisplayName}</td>
                    <td className="max-w-[320px] px-4 py-3 text-zinc-600">
                      {r.contentHref ? (
                        <Link href={r.contentHref} className="hover:underline">
                          {r.contentExcerpt}
                        </Link>
                      ) : (
                        r.contentExcerpt
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {r.reason}
                      {r.details && <p className="mt-0.5 text-xs text-zinc-400">{r.details}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AdminActionButton
                          label={t("resolveButton")}
                          pendingLabel={t("resolvePending")}
                          variant="primary"
                          action={async () => {
                            "use server";
                            return resolveReportAction(typedLocale, r.id);
                          }}
                        />
                        <AdminActionButton
                          label={t("dismissButton")}
                          pendingLabel={t("dismissPending")}
                          variant="secondary"
                          action={async () => {
                            "use server";
                            return dismissReportAction(typedLocale, r.id);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("requestedHeading")}</h3>
        <Card padding="none" className="overflow-x-auto">
          {requested.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">{t("requestedEmpty")}</p>
          ) : (
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("requestedColumnUniversity")}</th>
                  <th className="px-4 py-3 font-medium">{t("requestedColumnCountry")}</th>
                  <th className="px-4 py-3 font-medium">{t("requestedColumnWebsite")}</th>
                  <th className="px-4 py-3 font-medium">{t("requestedColumnRequestedAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {requested.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.universityName}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.countryCode ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {r.officialWebsite ? (
                        <a href={r.officialWebsite} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:text-zinc-900">
                          {r.officialWebsite}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
