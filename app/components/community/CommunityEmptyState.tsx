import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** A university with zero posts must still feel usable, not dead --
 * AGENTS.md section 17 ("Be the first to start this community"). */
export default async function CommunityEmptyState({ universityId }: { universityId: string }) {
  const t = await getTranslations("Community");

  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-900">{t("emptyHeading")}</h2>
        <p className="text-sm text-zinc-500">{t("emptyBody")}</p>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-zinc-600">
        <li>• {t("emptySuggestionApplications")}</li>
        <li>• {t("emptySuggestionHousing")}</li>
        <li>• {t("emptySuggestionVisa")}</li>
        <li>• {t("emptySuggestionPortfolio")}</li>
        <li>• {t("emptySuggestionStudentLife")}</li>
      </ul>
      <Link
        href={`/universities/${universityId}/community/new`}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        {t("askFirstQuestion")}
      </Link>
    </div>
  );
}
