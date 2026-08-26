import { useTranslations } from "next-intl";
import { getUrgency } from "@/app/lib/journey";
import { URGENCY_STYLES } from "@/app/lib/task-categories";

export default function UrgencyBadge({
  dueAt,
  className = "",
}: {
  dueAt: string;
  className?: string;
}) {
  const t = useTranslations("Urgency");
  const { key, days } = getUrgency(dueAt);
  const style = URGENCY_STYLES[key];

  const label =
    key === "overdue"
      ? t("overdue")
      : days === 0
        ? t("dueToday")
        : t("dueInDays", { count: days });

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style.badgeClass} ${className}`}
    >
      {label}
    </span>
  );
}
