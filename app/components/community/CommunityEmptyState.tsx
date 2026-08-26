import { getTranslations } from "next-intl/server";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/** A university with zero posts must still feel usable, not dead --
 * AGENTS.md section 17 ("Be the first to start this community"). */
export default async function CommunityEmptyState({ universityId }: { universityId: string }) {
  const t = await getTranslations("Community");

  return (
    <EmptyState
      title={t("emptyHeading")}
      description={t("emptyBody")}
      action={
        <div className="flex flex-col items-center gap-4">
          <ul className="flex flex-col gap-1 text-start text-sm text-zinc-600">
            <li>• {t("emptySuggestionApplications")}</li>
            <li>• {t("emptySuggestionHousing")}</li>
            <li>• {t("emptySuggestionVisa")}</li>
            <li>• {t("emptySuggestionPortfolio")}</li>
            <li>• {t("emptySuggestionStudentLife")}</li>
          </ul>
          <Button href={`/universities/${universityId}/community/new`}>
            {t("askFirstQuestion")}
          </Button>
        </div>
      }
    />
  );
}
