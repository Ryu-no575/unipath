import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getRealDataStatus } from "@/app/lib/data/admin";
import ValidateSourcesButton from "@/app/components/admin/ValidateSourcesButton";

function StatCard({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const content = (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-2xl font-semibold text-zinc-900">{value}</span>
      {note && <span className="text-xs text-zinc-400">{note}</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function formatTimestamp(value: string | null, never: string, locale: string): string {
  if (!value) return never;
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Admin Dashboard (task brief item 5): real, live counts against Supabase --
 * never a cached or hand-maintained figure (see app/lib/data/admin.ts).
 * Authorization is entirely handled by app/[locale]/(app)/admin/layout.tsx,
 * which every /admin/* route renders through; this page trusts that gate and
 * only fetches data.
 */
export default async function AdminDashboardPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const status = await getRealDataStatus(supabase);

  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{t("dataHealthHeading")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t("universitiesLabel")} value={t("universitiesReal", { count: status.universitiesCount })} href="/admin/universities" />
          <StatCard label={t("verifiedUniversitiesLabel")} value={String(status.verifiedUniversitiesCount)} href="/admin/universities" />
          <StatCard label={t("programsLabel")} value={t("programsVerified", { count: status.programsVerifiedCount })} note={`${status.programsCount} total`} href="/admin/programs" />
          <StatCard label={t("admissionsVerifiedLabel")} value={String(status.admissionsVerifiedCount)} />
          <StatCard label={t("sourcesLabel")} value={String(status.sourcesCount)} href="/admin/sources" />
          <StatCard label={t("sourceHealthHealthyLabel")} value={String(status.sourceHealth.healthy)} href="/admin/sources" />
          <StatCard label={t("sourceHealthBrokenLabel")} value={String(status.sourceHealth.broken)} href="/admin/sources" />
          <StatCard label={t("pendingChangesLabel")} value={String(status.pendingChangesCount)} href="/admin/changes" />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{t("communityHeading")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t("pendingReportsLabel")} value={String(status.pendingReportsCount)} href="/admin/community" />
          <StatCard label={t("requestedUniversitiesLabel")} value={String(status.requestedUniversitiesCount)} href="/admin/community" />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{t("systemHeading")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t("lastSyncLabel")} value={formatTimestamp(status.lastUniversitySyncAt, t("neverLabel"), locale)} />
          <StatCard label={t("lastValidationLabel")} value={formatTimestamp(status.lastSourceValidationAt, t("neverLabel"), locale)} />
          <StatCard
            label={t("simulatedEventsLabel")}
            value={String(status.simulatedChangeEventsCount)}
            note={t("simulatedEventsNote")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">{t("coverageByCountryHeading")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {status.coverageByCountry.slice(0, 12).map((row) => (
              <li key={row.countryCode ?? "unknown"} className="flex items-center justify-between">
                <span className="text-zinc-600">{row.countryCode ?? t("unknownCountry")}</span>
                <span className="font-medium text-zinc-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">{t("coverageByFieldHeading")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {status.coverageByField.length === 0 && <li className="text-zinc-400">{t("coverageEmpty")}</li>}
            {status.coverageByField.slice(0, 12).map((row) => (
              <li key={row.field ?? "unknown"} className="flex items-center justify-between">
                <span className="text-zinc-600">{row.field ?? t("unknownField")}</span>
                <span className="font-medium text-zinc-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">{t("sourceHealthHeading")}</h2>
          <ValidateSourcesButton locale={locale} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={t("sourceHealthTotalLabel")} value={String(status.sourceHealth.total)} />
          <StatCard label={t("sourceHealthHealthyLabel")} value={String(status.sourceHealth.healthy)} />
          <StatCard label={t("sourceHealthRedirectedLabel")} value={String(status.sourceHealth.redirected)} />
          <StatCard label={t("sourceHealthBrokenLabel")} value={String(status.sourceHealth.broken)} />
        </div>
        <p className="text-xs text-zinc-400">
          {t("sourceHealthNeedsReviewNote", { count: status.sourceHealth.needsReview })}
        </p>

        {status.sourceHealth.brokenSources.length > 0 && (
          <div className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-100 pt-3">
            {status.sourceHealth.brokenSources.map((source) => (
              <div key={source.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="font-medium text-zinc-900">{source.universityName}</span>
                <span className="text-xs text-zinc-500">
                  {source.pageType ?? t("sourceHealthUnknownPageType")} · {source.urlStatus}
                  {source.validationError ? ` — ${source.validationError}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
