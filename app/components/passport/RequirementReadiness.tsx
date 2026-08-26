import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ApplicationReadinessResult } from "@/app/lib/data/passport";
import Progress from "../ui/Progress";

export default function RequirementReadiness({
  readiness,
  communityHref,
}: {
  readiness: ApplicationReadinessResult;
  communityHref?: string | null;
}) {
  const t = useTranslations("Readiness");

  if (readiness.status === "limited") {
    const unknownItems = readiness.items.filter((i) => i.status === "unknown");
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm font-medium text-zinc-500">{t("limitedData")}</p>
        <p className="text-sm text-zinc-400">{t("limitedDataDetail")}</p>

        {unknownItems.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-zinc-100 pt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("unknownHeading")}</h3>
            <p className="text-xs text-zinc-400">{t("unknownDetail")}</p>
            <ul className="flex flex-col gap-1">
              {unknownItems.map((item) => (
                <li key={item.requirementId} className="text-sm text-zinc-600">
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link
            href="/passport"
            className="w-fit text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
          >
            {t("openPassport")}
          </Link>
          {communityHref && (
            <Link
              href={communityHref}
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
            >
              {t("askCommunity")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const ready = readiness.items.filter((i) => i.status === "ready");
  const missing = readiness.items.filter((i) => i.status === "missing");
  const unknown = readiness.items.filter((i) => i.status === "unknown");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">{t("heading")}</h2>
        <span className="text-lg font-semibold text-zinc-900">{readiness.scorePercent}%</span>
      </div>
      <Progress value={readiness.scorePercent ?? 0} />
      <p className="text-sm text-zinc-500">
        {t("summary", { ready: readiness.readyCount, total: readiness.trackableCount })}
      </p>

      {ready.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("readyHeading")}</h3>
          <ul className="flex flex-col gap-1">
            {ready.map((item) => (
              <li key={item.requirementId} className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-emerald-600" aria-hidden>
                  ✓
                </span>
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missing.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("missingHeading")}</h3>
          <ul className="flex flex-col gap-1">
            {missing.map((item) => (
              <li key={item.requirementId} className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-zinc-300" aria-hidden>
                  ○
                </span>
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unknown.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("unknownHeading")}</h3>
          <p className="text-xs text-zinc-400">{t("unknownDetail")}</p>
          <ul className="flex flex-col gap-1">
            {unknown.map((item) => (
              <li key={item.requirementId} className="text-sm text-zinc-600">
                {t("unverified")}: {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Link
          href="/passport"
          className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
        >
          {t("openPassport")}
        </Link>
        {communityHref && (
          <Link
            href={communityHref}
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline"
          >
            {t("askCommunity")}
          </Link>
        )}
      </div>
    </div>
  );
}
