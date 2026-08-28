import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { listAdminUniversities } from "@/app/lib/data/adminUniversities";
import type { DataStatus, VerificationConfidence } from "@/app/lib/data/dataStatus";
import Card from "@/app/components/ui/Card";
import Badge, { type BadgeTone } from "@/app/components/ui/Badge";

type ViewFilter = "all" | DataStatus | "broken" | "no_source" | "duplicates";

function filterHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/admin/universities?${qs}` : "/admin/universities";
}

export default async function AdminUniversitiesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/universities">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolved = await searchParams;
  const view = (typeof resolved.view === "string" ? resolved.view : "all") as ViewFilter;
  const countryFilter = typeof resolved.country === "string" ? resolved.country : "";

  const t = await getTranslations("AdminUniversities");
  const supabase = await createClient();
  const all = await listAdminUniversities(supabase);

  const countries = Array.from(new Set(all.map((u) => u.countryCode).filter((c): c is string => Boolean(c)))).sort();

  const summary = {
    verified: all.filter((u) => u.dataStatus === "verified").length,
    needsReview: all.filter((u) => u.dataStatus === "needs_review").length,
    imported: all.filter((u) => u.dataStatus === "imported").length,
    broken: all.filter((u) => u.isBrokenSource).length,
    noSource: all.filter((u) => u.isNoOfficialSource).length,
    duplicates: all.filter((u) => u.isDuplicateCandidate).length,
  };

  let rows = all;
  if (view === "verified" || view === "imported" || view === "needs_review" || view === "demo") {
    rows = rows.filter((u) => u.dataStatus === view);
  } else if (view === "broken") {
    rows = rows.filter((u) => u.isBrokenSource);
  } else if (view === "no_source") {
    rows = rows.filter((u) => u.isNoOfficialSource);
  } else if (view === "duplicates") {
    rows = rows.filter((u) => u.isDuplicateCandidate);
  }
  if (countryFilter) rows = rows.filter((u) => u.countryCode === countryFilter);

  const statusLabel: Record<DataStatus, string> = {
    verified: t("statusVerified"),
    imported: t("statusImported"),
    needs_review: t("statusNeedsReview"),
    demo: t("statusDemo"),
  };
  const statusTone: Record<DataStatus, BadgeTone> = {
    verified: "success",
    imported: "info",
    needs_review: "warning",
    demo: "neutral",
  };
  const confidenceLabel: Record<VerificationConfidence, string> = {
    high: t("confidenceHigh"),
    medium: t("confidenceMedium"),
    low: t("confidenceLow"),
  };
  const confidenceTone: Record<VerificationConfidence, BadgeTone> = {
    high: "success",
    medium: "warning",
    low: "danger",
  };

  const views: { value: ViewFilter; label: string; count: number }[] = [
    { value: "all", label: t("filterAll"), count: all.length },
    { value: "verified", label: t("filterVerified"), count: summary.verified },
    { value: "needs_review", label: t("filterNeedsReview"), count: summary.needsReview },
    { value: "imported", label: t("filterImported"), count: summary.imported },
    { value: "broken", label: t("filterBroken"), count: summary.broken },
    { value: "no_source", label: t("filterNoSource"), count: summary.noSource },
    { value: "duplicates", label: t("filterDuplicates"), count: summary.duplicates },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("summaryVerified")}</p>
          <p className="text-2xl font-semibold text-emerald-700">{summary.verified}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("summaryNeedsReview")}</p>
          <p className="text-2xl font-semibold text-amber-700">{summary.needsReview}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("summaryBroken")}</p>
          <p className="text-2xl font-semibold text-red-700">{summary.broken}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("summaryImported")}</p>
          <p className="text-2xl font-semibold text-blue-700">{summary.imported}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {views.map(({ value, label, count }) => (
            <Link
              key={value}
              href={filterHref({ view: value, country: countryFilter || undefined })}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                view === value ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {label} ({count})
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          <Link
            href={filterHref({ view, country: undefined })}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
              !countryFilter ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {t("filterCountryAll")}
          </Link>
          {countries.map((code) => (
            <Link
              key={code}
              href={filterHref({ view, country: code })}
              className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                countryFilter === code ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              {code}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-400">{t("resultCount", { count: rows.length, total: all.length })}</p>

      <Card padding="none" className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{t("empty")}</p>
        ) : (
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t("columnUniversity")}</th>
                <th className="px-4 py-3 font-medium">{t("columnCountry")}</th>
                <th className="px-4 py-3 font-medium">{t("columnRor")}</th>
                <th className="px-4 py-3 font-medium">{t("columnSourceHealth")}</th>
                <th className="px-4 py-3 font-medium">{t("columnDataStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("columnConfidence")}</th>
                <th className="px-4 py-3 font-medium">{t("columnReviewReason")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link href={`/admin/universities/${u.id}`} className="hover:underline">
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.countryCode ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.rorId ? t("rorLinked") : t("rorMissing")}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {u.healthySourceCount} / {u.sourceCount}
                    {u.brokenSourceCount > 0 && <span className="ml-1 text-red-600">({u.brokenSourceCount} broken)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[u.dataStatus]}>{statusLabel[u.dataStatus]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={confidenceTone[u.confidence]}>{confidenceLabel[u.confidence]}</Badge>
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-xs text-zinc-500">
                    {u.reviewReasons.length > 0 ? u.reviewReasons.join(" · ") : "—"}
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
