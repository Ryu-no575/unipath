import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getRealDataStatus } from "@/app/lib/data/admin";
import DevStateError from "@/app/components/DevStateError";
import ValidateSourcesButton from "@/app/components/admin/ValidateSourcesButton";

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-2xl font-semibold text-zinc-900">{value}</span>
      {note && <span className="text-xs text-zinc-400">{note}</span>}
    </div>
  );
}

/**
 * Real Data Status -- development/admin diagnostics for Real University Data
 * v1 (see AGENTS.md task notes on Admin diagnostics). Gated to non-production
 * the same way app/lib/live-data/simulate.ts is: this codebase has no
 * admin-role system yet, so NODE_ENV is the only safe gate available without
 * inventing one for this alone. A real admin-role check is future work.
 */
export default async function AdminDataStatusPage({
  params,
}: PageProps<"/[locale]/admin">) {
  if (process.env.NODE_ENV === "production") notFound();

  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const supabase = await createClient();
  const status = await getRealDataStatus(supabase);

  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-amber-700">{t("devOnlyNotice")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("universitiesLabel")} value={t("universitiesReal", { count: status.universitiesCount })} />
        <StatCard label={t("programsLabel")} value={t("programsVerified", { count: status.programsVerifiedCount })} note={`${status.programsCount} total`} />
        <StatCard label={t("sourcesLabel")} value={String(status.sourcesCount)} />
        <StatCard label={t("sourcesCheckedLabel")} value={String(status.sourcesCheckedLast24hCount)} />
        <StatCard label={t("pendingChangesLabel")} value={String(status.pendingChangesCount)} />
        <StatCard
          label={t("simulatedEventsLabel")}
          value={String(status.simulatedChangeEventsCount)}
          note={t("simulatedEventsNote")}
        />
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
