import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getAdminUniversityDetail } from "@/app/lib/data/adminUniversityDetail";
import type { DataStatus, VerificationConfidence } from "@/app/lib/data/dataStatus";
import {
  keepUniversityNeedsReviewAction,
  manuallyVerifyUniversitySourceAction,
  rejectSourceAction,
  retryUniversitySourceValidationAction,
  unrejectSourceAction,
} from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge, { type BadgeTone } from "@/app/components/ui/Badge";
import AdminActionButton from "@/app/components/admin/AdminActionButton";
import UniversityStudentStatsForm from "@/app/components/admin/UniversityStudentStatsForm";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-800">{value}</span>
    </div>
  );
}

export default async function AdminUniversityDetailPage({
  params,
}: PageProps<"/[locale]/admin/universities/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const t = await getTranslations("AdminUniversityDetail");
  const supabase = await createClient();
  const detail = await getAdminUniversityDetail(supabase, id);
  if (!detail) notFound();

  const statusLabel: Record<DataStatus, string> = {
    verified: t("statusVerified"),
    imported: t("statusImported"),
    needs_review: t("statusNeedsReview"),
    demo: t("statusDemo"),
  };
  const statusTone: Record<DataStatus, BadgeTone> = {
    verified: "success",
    imported: "info",
    needs_review: "warning",
    demo: "neutral",
  };
  const confidenceLabel: Record<VerificationConfidence, string> = {
    high: t("confidenceHigh"),
    medium: t("confidenceMedium"),
    low: t("confidenceLow"),
  };
  const confidenceTone: Record<VerificationConfidence, BadgeTone> = {
    high: "success",
    medium: "warning",
    low: "danger",
  };

  const src = detail.officialWebsiteSource;
  const domainOk = src ? src.urlStatus !== "invalid_domain" : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/universities" className="text-xs text-zinc-400 hover:text-zinc-700 hover:underline">
          {t("backToList")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">{detail.name}</h2>
          <Badge tone={statusTone[detail.dataStatus]}>{statusLabel[detail.dataStatus]}</Badge>
          <Badge tone={confidenceTone[detail.confidence]}>{t("confidenceLabel", { level: confidenceLabel[detail.confidence] })}</Badge>
        </div>
      </div>

      {detail.reviewReasons.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{t("reviewReasonHeading")}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-amber-900">
            {detail.reviewReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("fieldName")} value={detail.name} />
          <Field label={t("fieldCountry")} value={detail.countryCode ?? t("notAvailable")} />
          <Field label={t("fieldCity")} value={detail.city ?? t("notAvailable")} />
          <Field
            label={t("fieldRorId")}
            value={
              detail.rorId ? (
                <a href={detail.rorId} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {detail.rorId}
                </a>
              ) : (
                t("notAvailable")
              )
            }
          />
          <Field
            label={t("fieldRorSource")}
            value={
              detail.rorSourceUrl ? (
                <a href={detail.rorSourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {t("viewRorRecord")}
                </a>
              ) : (
                t("notAvailable")
              )
            }
          />
          <Field
            label={t("fieldOfficialWebsite")}
            value={
              detail.officialWebsite ? (
                <a href={detail.officialWebsite} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                  {detail.officialWebsite}
                </a>
              ) : (
                t("notAvailable")
              )
            }
          />
          <Field
            label={t("fieldResolvedUrl")}
            value={
              src?.resolvedUrl ? (
                <a href={src.resolvedUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                  {src.resolvedUrl}
                </a>
              ) : (
                t("notAvailable")
              )
            }
          />
          <Field label={t("fieldHttpStatus")} value={src?.httpStatus ?? t("notAvailable")} />
          <Field
            label={t("fieldDomainValidation")}
            value={domainOk === null ? t("notAvailable") : domainOk ? t("domainMatch") : t("domainMismatch")}
          />
          <Field label={t("fieldUrlStatus")} value={src?.urlStatus ?? t("notAvailable")} />
          <Field label={t("fieldLastChecked")} value={src?.lastCheckedAt ? new Date(src.lastCheckedAt).toLocaleString(locale) : t("neverChecked")} />
          <Field label={t("fieldInstitutionType")} value={t(`institutionType_${detail.institutionNamePattern}`)} />
        </div>
        {src?.validationError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{src.validationError}</p>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">{t("actionsHeading")}</h3>
        <div className="flex flex-wrap gap-3">
          {src && (
            <AdminActionButton
              label={t("verifyButton")}
              pendingLabel={t("verifyPending")}
              variant="primary"
              action={async () => {
                "use server";
                return manuallyVerifyUniversitySourceAction(typedLocale, src.id, detail.id);
              }}
            />
          )}
          <AdminActionButton
            label={t("keepNeedsReviewButton")}
            pendingLabel={t("keepNeedsReviewPending")}
            variant="secondary"
            action={async () => {
              "use server";
              return keepUniversityNeedsReviewAction(typedLocale, detail.id);
            }}
          />
          {src &&
            (src.adminRejected ? (
              <AdminActionButton
                label={t("unmarkBrokenButton")}
                pendingLabel={t("unmarkBrokenPending")}
                variant="secondary"
                action={async () => {
                  "use server";
                  return unrejectSourceAction(typedLocale, src.id);
                }}
              />
            ) : (
              <AdminActionButton
                label={t("markBrokenButton")}
                pendingLabel={t("markBrokenPending")}
                variant="danger"
                action={async () => {
                  "use server";
                  return rejectSourceAction(typedLocale, src.id);
                }}
              />
            ))}
          {src && (
            <AdminActionButton
              label={t("retryButton")}
              pendingLabel={t("retryPending")}
              variant="secondary"
              action={async () => {
                "use server";
                return retryUniversitySourceValidationAction(typedLocale, src.id, detail.id);
              }}
            />
          )}
        </div>
        {!src && <p className="text-xs text-zinc-400">{t("noSourceToAct")}</p>}
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-zinc-900">{t("studentStatsHeading")}</h3>
        <p className="mb-3 text-xs text-zinc-400">{t("studentStatsSubheading")}</p>
        <UniversityStudentStatsForm universityId={detail.id} studentStats={detail.studentStats} />
      </Card>
    </div>
  );
}
