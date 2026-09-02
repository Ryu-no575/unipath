"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { ApplicationType, VisaItemKey } from "@/app/lib/supabase/database.types";
import { APPLICATION_TYPES } from "@/app/lib/profile-types";
import { getCountryOptions } from "@/app/lib/countries";
import { createVisaProfileAction, updateVisaProfileAction, addVisaItemAction, deleteVisaItemAction, addVisaSourceAction } from "@/app/lib/actions/adminVisa";
import Button from "@/app/components/ui/Button";

const VISA_ITEM_KEYS: VisaItemKey[] = [
  "check_visa_type",
  "passport_validity",
  "admission_letter",
  "financial_proof",
  "accommodation_proof",
  "insurance",
  "application_form",
  "appointment",
  "biometrics",
  "submit_application",
  "receive_decision",
  "residence_permit_registration",
  "local_registration",
  "student_card_registration",
  "health_registration",
  "other",
];

const POST_ARRIVAL_ITEM_KEYS = new Set<VisaItemKey>([
  "residence_permit_registration",
  "local_registration",
  "student_card_registration",
  "health_registration",
]);

/** "" means "leave unset" -- distinct from 0, which is a real (if unusual)
 * value an admin could enter. Converts to/from the nullable number the
 * action/DB column expects. */
function parseOptionalInt(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

const inputClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-xs text-red-600">{error}</p>;
}

export function CreateVisaProfileForm() {
  const t = useTranslations("AdminVisa");
  const locale = useLocale() as AppLocale;
  const countryOptions = getCountryOptions(locale);
  const router = useRouter();
  const [nationality, setNationality] = useState("");
  const [destination, setDestination] = useState("");
  const [studyLevel, setStudyLevel] = useState<ApplicationType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!nationality || !destination || !studyLevel) {
      setError(t("createValidation"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createVisaProfileAction(locale, {
        nationalityCountry: nationality,
        destinationCountry: destination,
        studyLevel,
      });
      if (result.error) setError(result.error);
      else if (result.id) router.push(`/${locale}/admin/visa/${result.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">{t("nationalityLabel")}</span>
        <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClasses}>
          <option value="">—</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">{t("destinationLabel")}</span>
        <select value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClasses}>
          <option value="">—</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">{t("studyLevelLabel")}</span>
        <select value={studyLevel} onChange={(e) => setStudyLevel(e.target.value as ApplicationType)} className={inputClasses}>
          <option value="">—</option>
          {APPLICATION_TYPES.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" onClick={submit} disabled={isPending} size="sm">
        {isPending ? t("saving") : t("createButton")}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

export function UpdateVisaProfileForm({
  profileId,
  initialVisaType,
  initialSummary,
  initialStatus,
  initialEarliestApplicationMonthsBeforeStart,
  initialProcessingWeeksMin,
  initialProcessingWeeksMax,
  initialLatestSafeSubmissionWeeksBeforeStart,
}: {
  profileId: string;
  initialVisaType: string;
  initialSummary: string;
  initialStatus: "verified" | "being_verified";
  initialEarliestApplicationMonthsBeforeStart: number | null;
  initialProcessingWeeksMin: number | null;
  initialProcessingWeeksMax: number | null;
  initialLatestSafeSubmissionWeeksBeforeStart: number | null;
}) {
  const t = useTranslations("AdminVisa");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [visaType, setVisaType] = useState(initialVisaType);
  const [summary, setSummary] = useState(initialSummary);
  const [status, setStatus] = useState<"verified" | "being_verified">(initialStatus);
  const [earliestMonths, setEarliestMonths] = useState(initialEarliestApplicationMonthsBeforeStart?.toString() ?? "");
  const [processingMin, setProcessingMin] = useState(initialProcessingWeeksMin?.toString() ?? "");
  const [processingMax, setProcessingMax] = useState(initialProcessingWeeksMax?.toString() ?? "");
  const [latestSafeWeeks, setLatestSafeWeeks] = useState(initialLatestSafeSubmissionWeeksBeforeStart?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await updateVisaProfileAction(locale, profileId, {
        visaType,
        summary,
        status,
        earliestApplicationMonthsBeforeStart: parseOptionalInt(earliestMonths),
        processingWeeksMin: parseOptionalInt(processingMin),
        processingWeeksMax: parseOptionalInt(processingMax),
        latestSafeSubmissionWeeksBeforeStart: parseOptionalInt(latestSafeWeeks),
      });
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">{t("visaTypeLabel")}</span>
        <input value={visaType} onChange={(e) => setVisaType(e.target.value)} className={inputClasses} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">{t("summaryLabel")}</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputClasses} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">{t("statusLabel")}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as "verified" | "being_verified")} className={inputClasses}>
          <option value="being_verified">{t("statusBeingVerified")}</option>
          <option value="verified">{t("statusVerified")}</option>
        </select>
      </label>

      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{t("timingSectionHeading")}</p>
      <p className="text-xs text-zinc-500">{t("timingSectionHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("earliestMonthsLabel")}</span>
          <input
            type="number"
            min={0}
            value={earliestMonths}
            onChange={(e) => setEarliestMonths(e.target.value)}
            placeholder={t("timingUnknownPlaceholder")}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("latestSafeWeeksLabel")}</span>
          <input
            type="number"
            min={0}
            value={latestSafeWeeks}
            onChange={(e) => setLatestSafeWeeks(e.target.value)}
            placeholder={t("timingUnknownPlaceholder")}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("processingWeeksMinLabel")}</span>
          <input
            type="number"
            min={0}
            value={processingMin}
            onChange={(e) => setProcessingMin(e.target.value)}
            placeholder={t("timingUnknownPlaceholder")}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("processingWeeksMaxLabel")}</span>
          <input
            type="number"
            min={0}
            value={processingMax}
            onChange={(e) => setProcessingMax(e.target.value)}
            placeholder={t("timingUnknownPlaceholder")}
            className={inputClasses}
          />
        </label>
      </div>

      <div>
        <Button type="button" onClick={submit} disabled={isPending} size="sm">
          {isPending ? t("saving") : t("saveButton")}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function AddVisaItemForm({ profileId, nextOrderIndex }: { profileId: string; nextOrderIndex: number }) {
  const t = useTranslations("AdminVisa");
  const itemT = useTranslations("VisaItemOptions");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [itemKey, setItemKey] = useState<VisaItemKey>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(true);
  const [daysAfterArrival, setDaysAfterArrival] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPostArrival = POST_ARRIVAL_ITEM_KEYS.has(itemKey);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addVisaItemAction(locale, profileId, {
        itemKey,
        title,
        description,
        required,
        orderIndex: nextOrderIndex,
        deadlineDaysAfterArrival: isPostArrival ? parseOptionalInt(daysAfterArrival) : null,
      });
      if (result.error) setError(result.error);
      else {
        setTitle("");
        setDescription("");
        setDaysAfterArrival("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-zinc-300 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={itemKey} onChange={(e) => setItemKey(e.target.value as VisaItemKey)} className={inputClasses}>
          {VISA_ITEM_KEYS.map((key) => (
            <option key={key} value={key}>
              {itemT(key)}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("itemTitlePlaceholder")}
          className={inputClasses}
        />
      </div>
      {isPostArrival && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("deadlineDaysAfterArrivalLabel")}</span>
          <input
            type="number"
            min={0}
            value={daysAfterArrival}
            onChange={(e) => setDaysAfterArrival(e.target.value)}
            placeholder={t("timingUnknownPlaceholder")}
            className={inputClasses}
          />
        </label>
      )}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("itemDescriptionPlaceholder")}
        rows={2}
        className={inputClasses}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        {t("itemRequiredLabel")}
      </label>
      <div>
        <Button type="button" onClick={submit} disabled={isPending} size="sm" variant="secondary">
          {isPending ? t("saving") : t("addItemButton")}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function DeleteVisaItemButton({ profileId, itemId }: { profileId: string; itemId: string }) {
  const t = useTranslations("AdminVisa");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await deleteVisaItemAction(locale, profileId, itemId);
          router.refresh();
        })
      }
      className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-60"
    >
      {isPending ? t("saving") : t("removeButton")}
    </button>
  );
}

export function AddVisaSourceForm({ profileId }: { profileId: string }) {
  const t = useTranslations("AdminVisa");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!url.trim()) {
      setError(t("sourceUrlValidation"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addVisaSourceAction(locale, profileId, { url, title, publisher });
      if (result.error) setError(result.error);
      else {
        setUrl("");
        setTitle("");
        setPublisher("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-zinc-300 p-3">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("sourceUrlPlaceholder")}
        className={inputClasses}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("sourceTitlePlaceholder")}
          className={inputClasses}
        />
        <input
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          placeholder={t("sourcePublisherPlaceholder")}
          className={inputClasses}
        />
      </div>
      <div>
        <Button type="button" onClick={submit} disabled={isPending} size="sm" variant="secondary">
          {isPending ? t("saving") : t("addSourceButton")}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}
