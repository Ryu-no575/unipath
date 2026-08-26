import { getTranslations } from "next-intl/server";
import Tabs from "@/app/components/ui/Tabs";

export type PlanTab = "overview" | "route" | "applications" | "passport" | "calendar";

export default async function PlanTabs({ active }: { active: PlanTab }) {
  const t = await getTranslations("Plan");

  const items: { key: PlanTab; label: string; href: string }[] = [
    { key: "overview", label: t("tabOverview"), href: "/plan" },
    { key: "route", label: t("tabRoute"), href: "/routes" },
    { key: "applications", label: t("tabApplications"), href: "/applications" },
    { key: "passport", label: t("tabPassport"), href: "/passport" },
    { key: "calendar", label: t("tabCalendar"), href: "/calendar" },
  ];

  return <Tabs items={items.map((item) => ({ ...item, active: item.key === active }))} />;
}
