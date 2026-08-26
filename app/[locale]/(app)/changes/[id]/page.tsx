import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getChangeEventDetail } from "@/app/lib/data/changes";
import DevStateError from "@/app/components/DevStateError";
import ImportanceBadge from "@/app/components/updates/ImportanceBadge";
import OfficialSourceLink from "@/app/components/updates/OfficialSourceLink";

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-900">{value || "—"}</span>
    </div>
  );
}

export default async function ChangeDetailPage({
  params,
}: PageProps<"/[locale]/changes/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const supabase = await createClient();
  const change = await getChangeEventDetail(supabase, id);
  if (!change) notFound();

  const t = await getTranslations("Changes");
  const liveData = await getTranslations("LiveData");
  const reviewStatusT = await getTranslations("ReviewStatus");
  const format = await getFormatter();

  const affectedProgram = [change.universityName, change.programName].filter(Boolean).join(" — ") || null;
  const heading = affectedProgram ? `${affectedProgram}: ${change.fieldLabel}` : change.fieldLabel;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard"
        className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        {t("back")}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{heading}</h1>
          <ImportanceBadge importance={change.importance} />
        </div>
        <p className="text-xs text-zinc-400">
          {format.dateTime(new Date(change.detectedAt), { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
          <div className="flex flex-col divide-y divide-zinc-100">
            <DetailField label={liveData("affectedProgram")} value={affectedProgram} />
            <DetailField label={liveData("changedField")} value={change.fieldLabel} />
            <DetailField
              label={liveData("detectedAt")}
              value={format.dateTime(new Date(change.detectedAt), { dateStyle: "long", timeStyle: "short" })}
            />
            <DetailField label={liveData("reviewStatus")} value={reviewStatusT(change.reviewStatus)} />
          </div>
          <div className="flex flex-col divide-y divide-zinc-100">
            <DetailField label={liveData("oldValue")} value={change.oldValue} />
            <DetailField label={liveData("newValue")} value={change.newValue} />
          </div>
        </div>
        <div className="mt-2 border-t border-zinc-100 pt-4">
          <OfficialSourceLink url={change.officialUrl} publisher={change.sourcePublisher} />
        </div>
      </div>
    </div>
  );
}
