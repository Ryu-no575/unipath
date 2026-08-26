import { getTranslations } from "next-intl/server";
import type { StudentStatus } from "@/app/lib/supabase/database.types";

const ORDER: StudentStatus[] = ["applicant", "admitted", "current_student", "alumni"];
const LABEL_KEYS = {
  applicant: "applicant",
  admitted: "admitted",
  current_student: "currentStudent",
  alumni: "alumni",
} as const satisfies Record<StudentStatus, string>;

/** Real counts only -- 0 stays 0, never padded. See AGENTS.md section 18. */
export default async function MemberStats({ counts }: { counts: Record<StudentStatus, number> }) {
  const t = await getTranslations("StudentStatusOptions");

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-zinc-200 bg-white px-5 py-4">
      {ORDER.map((status) => (
        <div key={status} className="flex flex-col">
          <span className="text-lg font-semibold text-zinc-900">{counts[status]}</span>
          <span className="text-xs text-zinc-500">{t(LABEL_KEYS[status])}</span>
        </div>
      ))}
    </div>
  );
}
