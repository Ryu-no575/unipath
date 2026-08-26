import { getTranslations } from "next-intl/server";
import Tabs from "@/app/components/ui/Tabs";

export type UniversityTab = "overview" | "admissions" | "yourFit" | "studentReality" | "community";

export default async function UniversityTabs({
  universityId,
  active,
}: {
  universityId: string;
  active: UniversityTab;
}) {
  const t = await getTranslations("UniversityDetail");
  const base = `/universities/${universityId}`;

  const items: { key: UniversityTab; label: string; href: string }[] = [
    { key: "overview", label: t("tabOverview"), href: base },
    { key: "admissions", label: t("tabAdmissions"), href: `${base}/admissions` },
    { key: "yourFit", label: t("tabYourFit"), href: `${base}/your-fit` },
    { key: "studentReality", label: t("tabStudentReality"), href: `${base}/student-reality` },
    { key: "community", label: t("tabCommunity"), href: `${base}/community` },
  ];

  return (
    <Tabs items={items.map((item) => ({ ...item, active: item.key === active }))} />
  );
}
