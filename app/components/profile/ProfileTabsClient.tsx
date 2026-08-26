"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import Tabs from "@/app/components/ui/Tabs";

type ProfileTab = "personal" | "preferences" | "settings";

export default function ProfileTabsClient() {
  const t = useTranslations("Profile");
  const pathname = usePathname();

  const active: ProfileTab = pathname.startsWith("/profile/preferences")
    ? "preferences"
    : pathname.startsWith("/profile/settings")
      ? "settings"
      : "personal";

  const items: { key: ProfileTab; label: string; href: string }[] = [
    { key: "personal", label: t("tabPersonal"), href: "/profile" },
    { key: "preferences", label: t("tabPreferences"), href: "/profile/preferences" },
    { key: "settings", label: t("tabSettings"), href: "/profile/settings" },
  ];

  return <Tabs items={items.map((item) => ({ ...item, active: item.key === active }))} />;
}
