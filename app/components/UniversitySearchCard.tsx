import { useTranslations } from "next-intl";
import type { UniversitySearchResult } from "@/app/lib/ror";
import { Link } from "@/i18n/navigation";

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildNewApplicationHref(result: UniversitySearchResult): string {
  const params = new URLSearchParams();
  params.set("universityName", result.name);
  if (result.countryCode) params.set("country", result.countryCode);
  return `/applications/new?${params.toString()}`;
}

export default function UniversitySearchCard({
  result,
}: {
  result: UniversitySearchResult;
}) {
  const t = useTranslations("UniversitySearchCard");
  const location = [result.city, result.country].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-zinc-900">{result.name}</h3>
        <p className="text-sm text-zinc-500">{location || t("locationUnknown")}</p>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400">{t("established")}</span>
          <span className="font-medium text-zinc-900">
            {result.established ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-zinc-400">{t("website")}</span>
          <span className="truncate font-medium text-zinc-900">
            {result.website ? safeHostname(result.website) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-zinc-400">{t("rorId")}</span>
          <span className="truncate font-mono text-xs text-zinc-500">
            {result.rorId}
          </span>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-4">
        {result.website ? (
          <a
            href={result.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {t("viewUniversity")}
          </a>
        ) : (
          <span
            aria-disabled
            className="flex-1 cursor-not-allowed rounded-md border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-300"
          >
            {t("viewUniversity")}
          </span>
        )}
        <Link
          href={buildNewApplicationHref(result)}
          className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("addToApplications")}
        </Link>
      </div>
    </div>
  );
}
