"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database, DocumentStatus, DocumentType } from "@/app/lib/supabase/database.types";
import { APPLICATION_SPECIFIC_DOCUMENT_TYPES, DOCUMENT_TYPES } from "@/app/lib/passport/readiness";
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_STYLES } from "@/app/lib/passport/constants";
import {
  deleteDocumentAction,
  getDocumentSignedUrlAction,
  linkDocumentToApplicationAction,
  replaceDocumentAction,
  unlinkDocumentFromApplicationAction,
  updateDocumentAction,
} from "@/app/lib/actions/passport-documents";
import type { ApplicationOption } from "./DocumentList";

type ApplicationDocumentRow = Database["public"]["Tables"]["application_documents"]["Row"];

const fieldClasses =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-xs font-medium text-zinc-600";

export default function DocumentCard({
  locale,
  document,
  linkedApplicationIds,
  applicationOptions,
}: {
  locale: AppLocale;
  document: ApplicationDocumentRow;
  linkedApplicationIds: string[];
  applicationOptions: ApplicationOption[];
}) {
  const t = useTranslations("PassportDocuments");
  const documentTypeT = useTranslations("DocumentTypeOptions");
  const statusT = useTranslations("DocumentStatusOptions");

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [documentType, setDocumentType] = useState<DocumentType>(document.document_type);
  const [status, setStatus] = useState<DocumentStatus>(document.status);
  const [languageCode, setLanguageCode] = useState(document.language_code ?? "");
  const [linkTarget, setLinkTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const isAppSpecific = APPLICATION_SPECIFIC_DOCUMENT_TYPES.includes(document.document_type);

  function open() {
    startTransition(async () => {
      const result = await getDocumentSignedUrlAction(document.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function replaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    startTransition(async () => {
      const result = await replaceDocumentAction(locale, document.id, file);
      if (result?.error) setError(result.error);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    });
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateDocumentAction(locale, document.id, {
        title,
        documentType,
        status,
        languageCode,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function remove() {
    if (typeof window !== "undefined" && !window.confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      await deleteDocumentAction(locale, document.id);
    });
  }

  function addLink() {
    if (!linkTarget) return;
    startTransition(async () => {
      const result = await linkDocumentToApplicationAction(locale, linkTarget, document.id);
      if (result?.error) setError(result.error);
      setLinkTarget("");
    });
  }

  function removeLink(applicationId: string) {
    startTransition(async () => {
      await unlinkDocumentFromApplicationAction(locale, applicationId, document.id);
    });
  }

  if (editing) {
    return (
      <li>
        <form
          onSubmit={saveEdit}
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
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
            >
              {isPending ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </li>
    );
  }

  const availableApplications = applicationOptions.filter((a) => !linkedApplicationIds.includes(a.id));
  const linkedApplications = applicationOptions.filter((a) => linkedApplicationIds.includes(a.id));

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-zinc-900">{document.title}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {documentTypeT(document.document_type)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOCUMENT_STATUS_STYLES[document.status].badgeClass}`}>
              {statusT(document.status)}
            </span>
            {document.language_code && (
              <span className="text-xs text-zinc-400">{document.language_code}</span>
            )}
          </div>
          <span className="text-xs text-zinc-400">
            {isAppSpecific ? t("appSpecificNote") : t("reusableNote")}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={open}
            disabled={isPending || !document.storage_path}
            className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline disabled:opacity-40"
          >
            {document.storage_path ? t("download") : t("noFileYet")}
          </button>
          <label className="cursor-pointer text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 hover:underline">
            {t("replace")}
            <input ref={replaceInputRef} type="file" className="hidden" onChange={replaceFile} />
          </label>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 hover:underline"
          >
            {t("edit")}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 hover:underline"
          >
            {t("delete")}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {isAppSpecific && (
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t("usedFor")}</span>
          {linkedApplications.length === 0 ? (
            <span className="text-sm text-zinc-400">{t("usedForNone")}</span>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {linkedApplications.map((application) => (
                <li
                  key={application.id}
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                >
                  {application.name}
                  <button
                    type="button"
                    onClick={() => removeLink(application.id)}
                    disabled={isPending}
                    aria-label={t("unlink")}
                    className="text-zinc-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {availableApplications.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={linkTarget}
                onChange={(e) => setLinkTarget(e.target.value)}
                className={fieldClasses}
              >
                <option value="">{t("linkToApplication")}</option>
                {availableApplications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addLink}
                disabled={isPending || !linkTarget}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40"
              >
                {t("save")}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
