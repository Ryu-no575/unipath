import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ApplicationWithDetails } from "@/app/lib/data/applications";
import ApplicationStatusBadge from "./ApplicationStatusBadge";
import Progress from "../ui/Progress";
import DeadlineTime from "../DeadlineTime";
import UrgencyBadge from "../UrgencyBadge";

export default function ApplicationCard({
  application,
  userTimezone,
}: {
  application: ApplicationWithDetails;
  userTimezone: string | null;
}) {
  const t = useTranslations("Applications");
  const fields = useTranslations("Fields");
  const intakeSeasonOptions = useTranslations("IntakeSeasonOptions");
  const format = useFormatter();
  const deadline = application.admissionCycle?.applicationDeadline ?? null;
  const deadlineZone = application.admissionCycle?.deadlineTimezone ?? "UTC";

  return (
    <Link
      href={`/applications/${application.id}`}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {application.university?.name ?? t("unknownUniversity")}
          </h3>
          <p className="text-sm text-zinc-500">
            {application.program?.name}
            {application.program?.degreeType ? ` · ${application.program.degreeType}` : ""}
          </p>
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      {application.admissionCycle && (
        <p className="text-sm text-zinc-600">
          {intakeSeasonOptions(application.admissionCycle.intakeSeason)}{" "}
          {application.admissionCycle.intakeYear}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {fields("applicationDeadline")}
        </span>
        {deadline ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DeadlineTime
              isoInstant={deadline}
              sourceTimezone={deadlineZone}
              userTimezone={userTimezone}
            />
            <UrgencyBadge dueAt={deadline} />
          </div>
        ) : (
          <span className="text-sm text-zinc-400">{t("noDeadlineYet")}</span>
        )}
      </div>

      <Progress value={application.progress} />
      <p className="text-xs text-zinc-400">
        {t("updated", {
          date: format.dateTime(new Date(application.updatedAt), { dateStyle: "medium" }),
        })}
      </p>
    </Link>
  );
}
