import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { listAdminSources, type SourceHealthLabel } from "@/app/lib/data/adminSources";
import { rejectSourceAction, unrejectSourceAction } from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge, { type BadgeTone } from "@/app/components/ui/Badge";
import AdminActionButton from "@/app/components/admin/AdminActionButton";

export default async function AdminSourcesPage({ params }: PageProps<"/[locale]/admin/sources">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const t = await getTranslations("AdminSources");
  const supabase = await createClient();
  const sources = await listAdminSources(supabase);

  const healthLabel: Record<SourceHealthLabel, string> = {
    healthy: t("healthHealthy"),
    redirected: t("healthRedirected"),
    broken: t("healthBroken"),
    needs_review: t("healthNeedsReview"),
    rejected: t("healthRejected"),
  };
  const healthTone: Record<SourceHealthLabel, BadgeTone> = {
    healthy: "success",
    redirected: "info",
    broken: "danger",
    needs_review: "warning",
    rejected: "danger",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <Card padding="none" className="overflow-x-auto">
        {sources.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{t("empty")}</p>
        ) : (
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t("columnUrl")}</th>
                <th className="px-4 py-3 font-medium">{t("columnUniversity")}</th>
                <th className="px-4 py-3 font-medium">{t("columnProgram")}</th>
                <th className="px-4 py-3 font-medium">{t("columnPageType")}</th>
                <th className="px-4 py-3 font-medium">{t("columnHttpStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("columnHealth")}</th>
                <th className="px-4 py-3 font-medium">{t("columnLastChecked")}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="max-w-[260px] truncate px-4 py-3">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900">
                        {s.url}
                      </a>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {s.universityId ? <Link href={`/universities/${s.universityId}`} className="hover:underline">{s.universityName}</Link> : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{s.programName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{s.pageType ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{s.httpStatus ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={healthTone[s.health]}>{healthLabel[s.health]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    {s.adminRejected ? (
                      <AdminActionButton
                        label={t("unrejectButton")}
                        pendingLabel={t("unrejectPending")}
                        variant="secondary"
                        action={async () => {
                          "use server";
                          return unrejectSourceAction(typedLocale, s.id);
                        }}
                      />
                    ) : (
                      <AdminActionButton
                        label={t("rejectButton")}
                        pendingLabel={t("rejectPending")}
                        variant="danger"
                        action={async () => {
                          "use server";
                          return rejectSourceAction(typedLocale, s.id);
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
