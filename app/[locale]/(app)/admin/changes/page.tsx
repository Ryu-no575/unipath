import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { listPendingChangeEvents, listRecentChangeEvents, type AdminChangeEventRow } from "@/app/lib/data/adminChanges";
import { approveChangeEventAction, rejectChangeEventAction } from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import AdminActionButton from "@/app/components/admin/AdminActionButton";

function ChangeRow({
  change,
  locale,
  simulatedBadge,
  actions,
}: {
  change: AdminChangeEventRow;
  locale: AppLocale;
  simulatedBadge: string;
  actions?: { approve: string; approvePending: string; reject: string; rejectPending: string };
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-100 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{change.entityLabel}</p>
          <p className="text-xs text-zinc-500">{change.fieldLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {change.isSimulated && <Badge tone="neutral">{simulatedBadge}</Badge>}
          <Badge tone={change.importance === "critical" ? "danger" : change.importance === "important" ? "warning" : "neutral"}>
            {change.importance}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-red-50 px-2 py-1 text-red-700 line-through">{change.oldValue ?? "—"}</span>
        <span className="text-zinc-400">→</span>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{change.newValue ?? "—"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <span>
          {change.sourceUrl ? (
            <a href={change.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 hover:text-zinc-700">
              {change.sourceUrl}
            </a>
          ) : (
            "—"
          )}
        </span>
        <span>{new Date(change.detectedAt).toLocaleString()}</span>
      </div>

      {actions && (
        <div className="flex items-center gap-3 pt-1">
          <AdminActionButton
            label={actions.approve}
            pendingLabel={actions.approvePending}
            variant="primary"
            action={async () => {
              "use server";
              return approveChangeEventAction(locale, change.id);
            }}
          />
          <AdminActionButton
            label={actions.reject}
            pendingLabel={actions.rejectPending}
            variant="danger"
            action={async () => {
              "use server";
              return rejectChangeEventAction(locale, change.id);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default async function AdminChangesPage({ params }: PageProps<"/[locale]/admin/changes">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const t = await getTranslations("AdminChanges");
  const supabase = await createClient();
  const [pending, recent] = await Promise.all([listPendingChangeEvents(supabase), listRecentChangeEvents(supabase)]);

  const actions = {
    approve: t("approveButton"),
    approvePending: t("approvePending"),
    reject: t("rejectButton"),
    rejectPending: t("rejectPending"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("pendingHeading")}</h3>
        <Card>
          {pending.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("empty")}</p>
          ) : (
            pending.map((change) => (
              <ChangeRow key={change.id} change={change} locale={typedLocale} simulatedBadge={t("simulatedBadge")} actions={actions} />
            ))
          )}
        </Card>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">{t("recentHeading")}</h3>
        <Card>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("recentEmpty")}</p>
          ) : (
            recent.map((change) => <ChangeRow key={change.id} change={change} locale={typedLocale} simulatedBadge={t("simulatedBadge")} />)
          )}
        </Card>
      </div>
    </div>
  );
}
