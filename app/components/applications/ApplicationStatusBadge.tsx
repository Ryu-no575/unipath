import { useTranslations } from "next-intl";
import type { ApplicationStatus } from "@/app/lib/supabase/database.types";

const STYLES: Record<ApplicationStatus, string> = {
  considering: "bg-zinc-100 text-zinc-600",
  preparing: "bg-amber-50 text-amber-700",
  applied: "bg-blue-50 text-blue-700",
  interview: "bg-purple-50 text-purple-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  withdrawn: "bg-zinc-100 text-zinc-400",
};

export default function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const t = useTranslations("ApplicationStatusOptions");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      {t(status)}
    </span>
  );
}
