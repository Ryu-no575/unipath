import { useTranslations } from "next-intl";
import type { ChangeImportance } from "@/app/lib/supabase/database.types";

const STYLES: Record<ChangeImportance, string> = {
  critical: "bg-red-50 text-red-700",
  important: "bg-amber-50 text-amber-700",
  minor: "bg-zinc-100 text-zinc-600",
};

export default function ImportanceBadge({
  importance,
  className = "",
}: {
  importance: ChangeImportance;
  className?: string;
}) {
  const t = useTranslations("ChangeImportance");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[importance]} ${className}`}
    >
      {t(importance)}
    </span>
  );
}
