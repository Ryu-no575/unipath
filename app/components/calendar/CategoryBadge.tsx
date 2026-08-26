import { useTranslations } from "next-intl";
import type { TaskType } from "@/app/lib/supabase/database.types";
import { TASK_CATEGORY_STYLES } from "@/app/lib/task-categories";
import CategoryIcon from "./CategoryIcon";

export default function CategoryBadge({
  category,
  className = "",
}: {
  category: TaskType;
  className?: string;
}) {
  const t = useTranslations("TaskTypeOptions");
  const style = TASK_CATEGORY_STYLES[category];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.badgeClass} ${className}`}
    >
      <CategoryIcon category={category} />
      {t(style.labelKey)}
    </span>
  );
}
