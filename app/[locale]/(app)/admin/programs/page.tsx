import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { listAdminPrograms, type AdminVerificationBadges } from "@/app/lib/data/adminPrograms";
import { verifyProgramAction, flagProgramNeedsReviewAction } from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge, { type BadgeTone } from "@/app/components/ui/Badge";
import AdminActionButton from "@/app/components/admin/AdminActionButton";
import type { DataStatus } from "@/app/lib/data/dataStatus";

function BadgePill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge tone={ok ? "success" : "neutral"} className={ok ? "" : "opacity-60"}>
      {ok ? "✓" : "○"} {label}
    </Badge>
  );
}

export default async function AdminProgramsPage({ params }: PageProps<"/[locale]/admin/programs">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const [t, tStatus] = await Promise.all([
    getTranslations("AdminPrograms"),
    getTranslations("AdminUniversities"),
  ]);
  const supabase = await createClient();
  const programs = await listAdminPrograms(supabase);

  const statusLabel: Record<DataStatus, string> = {
    verified: tStatus("statusVerified"),
    imported: tStatus("statusImported"),
    needs_review: tStatus("statusNeedsReview"),
    demo: tStatus("statusDemo"),
  };
  const statusTone: Record<DataStatus, BadgeTone> = {
    verified: "success",
    imported: "info",
    needs_review: "warning",
    demo: "neutral",
  };

  const badgeLabels: Record<keyof AdminVerificationBadges, string> = {
    admissions: t("badgeAdmissions"),
    deadline: t("badgeDeadline"),
    tuition: t("badgeTuition"),
    languageRequirement: t("badgeLanguageRequirement"),
    portfolio: t("badgePortfolio"),
    entranceExam: t("badgeEntranceExam"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      {programs.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-400">{t("empty")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {programs.map((program) => (
            <Card key={program.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">{program.universityName}</p>
                  <h3 className="text-base font-semibold text-zinc-900">{program.programName}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {[program.degreeType, program.field, program.language, program.duration].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {program.officialUrl ? (
                    <a
                      href={program.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-1 inline-block text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
                    >
                      {program.officialUrl}
                    </a>
                  ) : (
                    <p className="mt-1 text-xs italic text-zinc-400">{t("noUrl")}</p>
                  )}
                </div>
                <Badge tone={statusTone[program.dataStatus]}>{statusLabel[program.dataStatus]}</Badge>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(badgeLabels) as (keyof AdminVerificationBadges)[]).map((key) => (
                  <BadgePill key={key} ok={program.badges[key]} label={badgeLabels[key]} />
                ))}
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-100 pt-3">
                <AdminActionButton
                  label={t("verifyButton")}
                  pendingLabel={t("verifyPending")}
                  variant="primary"
                  action={async () => {
                    "use server";
                    return verifyProgramAction(typedLocale, program.id);
                  }}
                />
                <AdminActionButton
                  label={t("flagButton")}
                  pendingLabel={t("flagPending")}
                  variant="secondary"
                  action={async () => {
                    "use server";
                    return flagProgramNeedsReviewAction(typedLocale, program.id);
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
