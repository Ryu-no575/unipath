"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Database } from "@/app/lib/supabase/database.types";
import type { DocumentLink } from "@/app/lib/data/passport";
import DocumentUploadForm from "./DocumentUploadForm";
import DocumentCard from "./DocumentCard";

type ApplicationDocumentRow = Database["public"]["Tables"]["application_documents"]["Row"];

export interface ApplicationOption {
  id: string;
  name: string;
}

export default function DocumentList({
  locale,
  documents,
  links,
  applicationOptions,
}: {
  locale: AppLocale;
  documents: ApplicationDocumentRow[];
  links: DocumentLink[];
  applicationOptions: ApplicationOption[];
}) {
  const t = useTranslations("PassportDocuments");
  const [uploading, setUploading] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {!uploading && (
          <button
            type="button"
            onClick={() => setUploading(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {t("upload")}
          </button>
        )}
      </div>

      {uploading && <DocumentUploadForm locale={locale} onDone={() => setUploading(false)} />}

      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              locale={locale}
              document={document}
              linkedApplicationIds={links.filter((l) => l.documentId === document.id).map((l) => l.applicationId)}
              applicationOptions={applicationOptions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
