import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ApplicationWithDetails } from "@/app/lib/data/applications";
import ApplicationCard from "./ApplicationCard";

export default function ApplicationsList({
  applications,
  userTimezone,
}: {
  applications: ApplicationWithDetails[];
  userTimezone: string | null;
}) {
  const t = useTranslations("Applications");

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-8">
        <p className="text-sm text-zinc-500">{t("empty")}</p>
        <Link
          href="/applications/new"
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("newApplication")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          userTimezone={userTimezone}
        />
      ))}
    </div>
  );
}
