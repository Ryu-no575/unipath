import { useTranslations } from "next-intl";
import type { University } from "@/app/lib/types";

export default function StatsBar({ universities }: { universities: University[] }) {
  const t = useTranslations("Stats");
  const status = useTranslations("ApplicationStatus");

  const stats = [
    { label: t("totalApplications"), value: universities.length },
    {
      label: status("Considering"),
      value: universities.filter((u) => u.status === "Considering").length,
    },
    {
      label: status("Preparing"),
      value: universities.filter((u) => u.status === "Preparing").length,
    },
    {
      label: status("Applied"),
      value: universities.filter((u) => u.status === "Applied").length,
    },
    {
      label: status("Accepted"),
      value: universities.filter((u) => u.status === "Accepted").length,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4"
        >
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">
            {stat.value}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
