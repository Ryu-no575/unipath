import { getTranslations } from "next-intl/server";
import type { StudentStatus } from "@/app/lib/supabase/database.types";

const STATUS_LABEL_KEYS = {
  applicant: "applicant",
  admitted: "admitted",
  current_student: "currentStudent",
  alumni: "alumni",
} as const satisfies Record<StudentStatus, string>;

/** Status and verification are always rendered as two separate signals --
 * never collapse "current_student" + unverified into a bare "Current
 * Student" label, per AGENTS.md section 7. */
export default async function StudentStatusBadge({
  status,
  verified,
}: {
  status: StudentStatus | null;
  verified: boolean;
}) {
  if (!status) return null;
  const t = await getTranslations("StudentStatusOptions");
  const common = await getTranslations("Community");

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
      {t(STATUS_LABEL_KEYS[status])}
      {verified ? (
        <span className="inline-flex items-center gap-0.5 text-emerald-600">
          <CheckIcon /> {common("verified")}
        </span>
      ) : (
        <span className="text-zinc-400">· {common("unverified")}</span>
      )}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}
