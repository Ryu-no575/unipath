"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import Tabs from "@/app/components/ui/Tabs";

type ExploreTab = "search" | "match" | "saved" | "compare";

export default function ExploreTabsClient() {
  const t = useTranslations("Explore");
  const pathname = usePathname();

  const active: ExploreTab = pathname.startsWith("/explore/match")
    ? "match"
    : pathname.startsWith("/explore/saved")
      ? "saved"
      : pathname.startsWith("/explore/compare")
        ? "compare"
        : "search";

  const items: { key: ExploreTab; label: string; href: string }[] = [
    { key: "search", label: t("tabSearch"), href: "/explore" },
    { key: "match", label: t("tabMatch"), href: "/explore/match" },
    { key: "saved", label: t("tabSaved"), href: "/explore/saved" },
    { key: "compare", label: t("tabCompare"), href: "/explore/compare" },
  ];

  return <Tabs items={items.map((item) => ({ ...item, active: item.key === active }))} />;
}
