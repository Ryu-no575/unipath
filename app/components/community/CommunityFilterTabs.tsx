import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CommunityPostType } from "@/app/lib/supabase/database.types";

// A curated subset of post_type -- the full enum exists for authoring
// (see CommunityPostTypeSelect), but the filter bar only surfaces the types
// AGENTS.md section 9 calls out plus "All".
const FILTERS = [
  { type: "all", labelKey: "filterAll" },
  { type: "question", labelKey: "filterQuestions" },
  { type: "admissions", labelKey: "filterAdmissions" },
  { type: "housing", labelKey: "filterHousing" },
  { type: "visa", labelKey: "filterVisa" },
  { type: "portfolio", labelKey: "filterPortfolio" },
  { type: "campus", labelKey: "filterCampus" },
  { type: "city_life", labelKey: "filterCityLife" },
] as const satisfies { type: CommunityPostType | "all"; labelKey: string }[];

export default async function CommunityFilterTabs({
  universityId,
  active,
}: {
  universityId: string;
  active: CommunityPostType | "all";
}) {
  const t = await getTranslations("Community");

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = filter.type === active;
        const href =
          filter.type === "all"
            ? `/universities/${universityId}/community`
            : `/universities/${universityId}/community?type=${filter.type}`;
        return (
          <Link
            key={filter.type}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {t(filter.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
