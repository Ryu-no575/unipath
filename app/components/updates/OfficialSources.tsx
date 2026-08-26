import { useFormatter, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { SourceSummary } from "@/app/lib/data/sources";
import { pickBestOfficialSource } from "@/app/lib/data/sources";
import { isHardBroken, isVerifiedStatus } from "@/app/lib/live-data/sourceStatus";
import CheckSourceButton from "./CheckSourceButton";

/** "Official source / Verified" section for a catalog entity -- transparent
 * either way: shows what's linked and when it was last checked, or says
 * plainly that nothing has been linked yet rather than implying every
 * catalog entry is already verified.
 *
 * Never links straight to a raw `sources.official_url`: confirmed-broken
 * sources (404 / 410 / wrong domain) are hidden from the list entirely, and
 * the primary link at the top follows the Broken URL fallback chain (see
 * app/lib/live-data/officialUrl.ts) so a program page that's gone still
 * lands the user on the university's admissions page or homepage instead of
 * a dead link. Each remaining source keeps its own "Check source now"
 * control that runs the real checkSource() pipeline against it. */
export default function OfficialSources({
  sources,
  locale,
  fallbackWebsite = null,
}: {
  sources: SourceSummary[];
  locale: AppLocale;
  fallbackWebsite?: string | null;
}) {
  const t = useTranslations("LiveData");
  const format = useFormatter();

  const best = pickBestOfficialSource(sources, fallbackWebsite);
  const usableSources = sources.filter((s) => !isHardBroken(s.urlStatus));
  const hasBrokenSources = usableSources.length < sources.length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{t("officialSourcesHeading")}</h2>

      {sources.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{t("noSourcesLinked")}</p>
      ) : (
        <>
          <div className="mt-2">
            {best.status === "unavailable" ? (
              <p className="text-sm text-amber-700">{t("sourceBeingReVerified")}</p>
            ) : (
              <a
                href={best.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
              >
                {t("officialSource")} →
                <span
                  className={
                    best.status === "verified"
                      ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
                  }
                >
                  {best.status === "verified" ? t("statusVerified") : t("statusNotYetVerified")}
                </span>
              </a>
            )}
          </div>

          {hasBrokenSources && <p className="mt-1 text-xs text-amber-600">{t("someSourcesUnavailableNotice")}</p>}

          <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
            {usableSources.map((source) => (
              <li
                key={source.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={source.resolvedUrl ?? source.officialUrl ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="w-fit text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                    >
                      {source.publisher ?? source.officialUrl ?? t("officialSource")}
                    </a>
                    <span
                      className={
                        isVerifiedStatus(source.urlStatus)
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
                      }
                    >
                      {isVerifiedStatus(source.urlStatus) ? t("statusVerified") : t("statusNotYetVerified")}
                    </span>
                    {source.urlStatus === "redirected" && (
                      <span className="text-[11px] text-zinc-400">{t("statusRedirectedNote")}</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {source.lastCheckedAt
                      ? t("lastCheckedAt", { time: format.relativeTime(new Date(source.lastCheckedAt)) })
                      : t("notYetChecked")}
                  </span>
                </div>
                <CheckSourceButton locale={locale} sourceId={source.id} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
