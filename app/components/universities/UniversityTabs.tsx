import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function UniversityTabs({
  universityId,
  active,
}: {
  universityId: string;
  active: "overview" | "community";
}) {
  const t = await getTranslations("UniversityDetail");

  const tabClass = (isActive: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  return (
    <nav className="flex gap-1 border-b border-zinc-200 pb-2">
      <Link
        href={`/universities/${universityId}`}
        aria-current={active === "overview" ? "page" : undefined}
        className={tabClass(active === "overview")}
      >
        {t("tabOverview")}
      </Link>
      <Link
        href={`/universities/${universityId}/community`}
        aria-current={active === "community" ? "page" : undefined}
        className={tabClass(active === "community")}
      >
        {t("tabCommunity")}
      </Link>
    </nav>
  );
}
