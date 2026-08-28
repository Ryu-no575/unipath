import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUniversityPriorities } from "@/app/lib/data/adminPriorities";
import type { PriorityTier } from "@/app/lib/priority/score";
import Card from "@/app/components/ui/Card";
import Badge, { type BadgeTone } from "@/app/components/ui/Badge";

const TOP_PRIORITIES_LIMIT = 50;

/**
 * Demand Priority Engine dashboard (task: University Data Strategy pivot,
 * section 9 "ADMIN DASHBOARD" / section 10 "CURRENT 357 UNIVERSITIES").
 * Tier counts and the Top N list are computed live from real Supabase data
 * via app/lib/data/adminPriorities.ts -- never a cached or hand-maintained
 * figure, same convention as the rest of /admin (see app/lib/data/admin.ts).
 *
 * Per-university "Why" / "Missing" / "Next" text comes straight out of
 * app/lib/priority/score.ts and is intentionally left untranslated (English)
 * regardless of locale, matching the existing convention for computed
 * diagnostic strings elsewhere in /admin (see describeUrlStatus and
 * computeUniversityReviewReasons in app/lib/data/dataStatus.ts) -- only the
 * page chrome around it is localized.
 */
export default async function AdminPrioritiesPage({
  params,
}: PageProps<"/[locale]/admin/priorities">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("AdminPriorities");
  const supabase = await createClient();
  const engine = await getUniversityPriorities(supabase);

  const tierLabel: Record<PriorityTier, string> = {
    tier_1_core: t("tier1Label"),
    tier_2_important: t("tier2Label"),
    tier_3_long_tail: t("tier3Label"),
  };
  const tierTone: Record<PriorityTier, BadgeTone> = {
    tier_1_core: "success",
    tier_2_important: "info",
    tier_3_long_tail: "neutral",
  };

  const weightRows: { key: keyof typeof engine.weights; label: string }[] = [
    { key: "internalDemand", label: t("weightInternalDemand") },
    { key: "internationalRelevance", label: t("weightInternationalRelevance") },
    { key: "programDemand", label: t("weightProgramDemand") },
    { key: "destinationDemand", label: t("weightDestinationDemand") },
    { key: "dataVerifiability", label: t("weightDataVerifiability") },
  ];

  const topPriorities = engine.universities.slice(0, TOP_PRIORITIES_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("tier1Label")}</p>
          <p className="text-2xl font-semibold text-emerald-700">{engine.tierCounts.tier_1_core}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("tier2Label")}</p>
          <p className="text-2xl font-semibold text-blue-700">{engine.tierCounts.tier_2_important}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("tier3Label")}</p>
          <p className="text-2xl font-semibold text-zinc-500">{engine.tierCounts.tier_3_long_tail}</p>
        </Card>
      </div>
      <p className="text-xs text-zinc-400">{t("tierNote")}</p>

      <Card padding="sm" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">{t("weightsHeading")}</h3>
          <Badge tone={engine.regime === "mature" ? "accent" : "warning"}>
            {engine.regime === "mature" ? t("regimeMature") : t("regimeEarlyStage")}
          </Badge>
        </div>
        <p className="text-xs text-zinc-400">{t("regimeNote", { count: engine.totalInternalDemandEvents })}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {weightRows.map((row) => (
            <div key={row.key} className="rounded-lg bg-zinc-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">{row.label}</p>
              <p className="text-sm font-semibold text-zinc-900">{Math.round(engine.weights[row.key] * 100)}%</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{t("topPrioritiesHeading")}</h3>
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t("columnRank")}</th>
                <th className="px-4 py-3 font-medium">{t("columnUniversity")}</th>
                <th className="px-4 py-3 font-medium">{t("columnCountry")}</th>
                <th className="px-4 py-3 font-medium">{t("columnTier")}</th>
                <th className="px-4 py-3 font-medium">{t("columnScore")}</th>
                <th className="px-4 py-3 font-medium">{t("columnWhy")}</th>
                <th className="px-4 py-3 font-medium">{t("columnMissing")}</th>
                <th className="px-4 py-3 font-medium">{t("columnNext")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {topPriorities.map((u, i) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-zinc-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <a href={`/admin/universities/${u.id}`} className="hover:underline">
                      {u.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.countryCode ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={tierTone[u.tier]}>{tierLabel[u.tier]}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-900">{u.score}</td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-zinc-500">{u.reasons.join(" · ")}</td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-zinc-500">{u.missingData.join(" · ") || "—"}</td>
                  <td className="max-w-[240px] px-4 py-3 text-xs text-zinc-500">{u.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
