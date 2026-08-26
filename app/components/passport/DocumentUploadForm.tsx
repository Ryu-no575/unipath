"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { DocumentStatus, DocumentType } from "@/app/lib/supabase/database.types";
import { DOCUMENT_TYPES } from "@/app/lib/passport/readiness";
import { DOCUMENT_STATUSES } from "@/app/lib/passport/constants";
import { uploadDocumentAction } from "@/app/lib/actions/passport-documents";

const fieldClasses =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-xs font-medium text-zinc-600";

export default function DocumentUploadForm({
  locale,
  onDone,
}: {
  locale: AppLocale;
  onDone: () => void;
}) {
  const t = useTranslations("PassportDocuments");
  const documentTypeT = useTranslations("DocumentTypeOptions");
  const statusT = useTranslations("DocumentStatusOptions");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentType, setDocumentType] = useState<DocumentType>("cv");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("ready");
  const [languageCode, setLanguageCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError(t("chooseFile"));
      return;
    }
    startTransition(async () => {
      const result = await uploadDocumentAction(
        locale,
        { documentType, title, status, languageCode },
        file,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("documentTypeLabel")}</span>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            className={fieldClasses}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {documentTypeT(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("titleLabel")}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("statusLabel")}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DocumentStatus)}
            className={fieldClasses}
          >
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusT(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClasses}>{t("languageLabel")}</span>
          <input
            type="text"
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            className={fieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClasses}>{t("fileLabel")}</span>
          <input ref={fileInputRef} type="file" required className="text-sm text-zinc-700" />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("uploading") : t("upload")}
        </button>
      </div>
    </form>
  );
}
