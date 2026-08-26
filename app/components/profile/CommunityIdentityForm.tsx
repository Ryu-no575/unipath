"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { StudentStatus } from "@/app/lib/supabase/database.types";
import { STUDENT_STATUSES } from "@/app/lib/community-types";
import { updateCommunityProfileAction } from "@/app/lib/actions/community";

const inputClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-sm font-medium text-zinc-700";

export default function CommunityIdentityForm({
  locale,
  initialDisplayName,
  initialStudentStatus,
  studentStatusVerified,
}: {
  locale: AppLocale;
  initialDisplayName: string;
  initialStudentStatus: StudentStatus | "";
  studentStatusVerified: boolean;
}) {
  const t = useTranslations("Community");
  const common = useTranslations("Common");
  const profileT = useTranslations("Profile");
  const statusOptions = useTranslations("StudentStatusOptions");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [studentStatus, setStudentStatus] = useState<StudentStatus | "">(initialStudentStatus);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCommunityProfileAction(locale, { displayName, studentStatus });
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-900">{t("identityHeading")}</h2>
        <p className="text-sm text-zinc-500">{t("identitySubheading")}</p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelClasses}>{t("displayNameLabel")}</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("displayNamePlaceholder")}
            maxLength={60}
            className={inputClasses}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClasses}>{t("studentStatusLabel")}</span>
          <select
            value={studentStatus}
            onChange={(e) => setStudentStatus(e.target.value as StudentStatus | "")}
            className={inputClasses}
          >
            <option value="">{common("selectPlaceholder")}</option>
            {STUDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusOptions(
                  status === "current_student"
                    ? "currentStudent"
                    : status === "applicant"
                      ? "applicant"
                      : status === "admitted"
                        ? "admitted"
                        : "alumni",
                )}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-400">
            {studentStatusVerified ? t("statusVerifiedNote") : t("statusUnverifiedNote")}
          </span>
        </label>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-sm text-emerald-600">{profileT("saved")}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? profileT("saving") : profileT("save")}
        </button>
      </div>
    </section>
  );
}
