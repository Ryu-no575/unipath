import { useTranslations } from "next-intl";
import type { UniversitySearchResult } from "@/app/lib/ror";
import { Link } from "@/i18n/navigation";
import SaveButton from "./explore/SaveButton";
import CompareToggleButton from "./explore/CompareToggleButton";
import type { SavedUniversityItem } from "@/app/lib/explore/savedUniversities";

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
  loggedIn,
}: {
  result: UniversitySearchResult;
  loggedIn: boolean;
}) {
  const t = useTranslations("UniversitySearchCard");
  const location = [result.city, result.country].filter(Boolean).join(", ");

  const savedItem: SavedUniversityItem = {
    key: `ror:${result.rorId}`,
    name: result.name,
    location: location || null,
    href: result.website ?? "",
    external: true,
    savedAt: Date.now(),
  };

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
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-zinc-100 pt-4">
        <div className="flex items-center gap-2">
          <SaveButton item={savedItem} loggedIn={loggedIn} />
          <Link
            href={buildNewApplicationHref(result)}
            className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {t("addToApplications")}
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2">
          {result.website ? (
            <a
              href={result.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
            >
              {t("viewUniversity")}
            </a>
          ) : (
            <span aria-disabled className="text-sm text-zinc-300">
              {t("viewUniversity")}
            </span>
          )}
          <CompareToggleButton item={savedItem} />
        </div>
      </div>
    </div>
  );
}
