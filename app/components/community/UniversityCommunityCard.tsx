import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CommunityUniversityCard as CommunityUniversityCardData } from "@/app/lib/data/community";

export default async function UniversityCommunityCard({
  university,
}: {
  university: CommunityUniversityCardData;
}) {
  const t = await getTranslations("Community");
  const location = [university.city, university.countryCode].filter(Boolean).join(", ");

  return (
    <Link
      href={`/universities/${university.id}/community`}
      className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <span className="text-sm font-semibold text-zinc-900">{university.name}</span>
      {location && <span className="text-xs text-zinc-500">{location}</span>}
      <span className="text-xs text-zinc-400">{t("postCount", { count: university.postCount })}</span>
    </Link>
  );
}
