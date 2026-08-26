"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { DocumentStatus, DocumentType } from "@/app/lib/supabase/database.types";
import type { PassportActionResult } from "./passport-education";

// Private bucket -- see the Storage section of
// supabase/migrations/20260826270000_application_passport_v1.sql. Every
// object path starts with "<user_id>/..." so storage RLS alone is enough to
// keep one user's files unreachable to everyone else; this code never uses
// the service-role client.
const BUCKET = "application-documents";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60;

function revalidatePassportPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/passport`);
  revalidatePath(`/${locale}/passport/documents`);
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return cleaned.slice(-120) || "file";
}

export interface DocumentMetadataInput {
  documentType: DocumentType;
  title: string;
  status: DocumentStatus;
  languageCode: string;
}

/** Creates the document row and uploads its first file version in one step.
 * Rolls the row back if the upload fails, so a document is never left
 * pointing at a file that doesn't exist. */
export async function uploadDocumentAction(
  locale: AppLocale,
  input: DocumentMetadataInput,
  file: File,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!file || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "File is too large (max 20MB)." };

  const title = input.title.trim() || file.name;

  const { data: doc, error: docError } = await supabase
    .from("application_documents")
    .insert({
      user_id: user.id,
      document_type: input.documentType,
      title,
      status: input.status,
      language_code: input.languageCode.trim() || null,
    })
    .select("id")
    .single();
  if (docError || !doc) return { error: docError?.message ?? "Failed to create the document." };

  const path = `${user.id}/${doc.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) {
    await supabase.from("application_documents").delete().eq("id", doc.id);
    return { error: uploadError.message };
  }

  const [{ error: versionError }, { error: pathError }] = await Promise.all([
    supabase.from("application_document_versions").insert({
      document_id: doc.id,
      storage_path: path,
      file_name: file.name,
      size_bytes: file.size,
    }),
    supabase.from("application_documents").update({ storage_path: path }).eq("id", doc.id),
  ]);
  if (versionError || pathError) return { error: (versionError ?? pathError)?.message };

  revalidatePassportPaths(locale);
  return {};
}

/** Uploads a new file for an existing document without deleting the
 * previous file -- see application_document_versions in the migration.
 * application_documents.storage_path is repointed at the new version. */
export async function replaceDocumentAction(
  locale: AppLocale,
  documentId: string,
  file: File,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!file || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "File is too large (max 20MB)." };

  const { data: doc } = await supabase
    .from("application_documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const path = `${user.id}/${doc.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const [{ error: versionError }, { error: pathError }] = await Promise.all([
    supabase.from("application_document_versions").insert({
      document_id: doc.id,
      storage_path: path,
      file_name: file.name,
      size_bytes: file.size,
    }),
    supabase.from("application_documents").update({ storage_path: path }).eq("id", doc.id),
  ]);
  if (versionError || pathError) return { error: (versionError ?? pathError)?.message };

  revalidatePassportPaths(locale);
  return {};
}

export async function updateDocumentAction(
  locale: AppLocale,
  documentId: string,
  input: DocumentMetadataInput,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = input.title.trim();
  if (!title) return { error: "Title is required." };

  const { error } = await supabase
    .from("application_documents")
    .update({
      title,
      document_type: input.documentType,
      status: input.status,
      language_code: input.languageCode.trim() || null,
    })
    .eq("id", documentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  return {};
}

/** Deletes the document row (cascades to its versions and application links)
 * and best-effort removes every uploaded file version from Storage. */
export async function deleteDocumentAction(
  locale: AppLocale,
  documentId: string,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: versions } = await supabase
    .from("application_document_versions")
    .select("storage_path")
    .eq("document_id", documentId);

  const { error } = await supabase
    .from("application_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  const paths = (versions ?? []).map((v) => v.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  revalidatePassportPaths(locale);
  return {};
}

export async function linkDocumentToApplicationAction(
  locale: AppLocale,
  applicationId: string,
  documentId: string,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("application_document_links")
    .insert({ application_id: applicationId, document_id: documentId });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePassportPaths(locale);
  revalidatePath(`/${locale}/applications/${applicationId}`);
  return {};
}

export async function unlinkDocumentFromApplicationAction(
  locale: AppLocale,
  applicationId: string,
  documentId: string,
): Promise<PassportActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("application_document_links")
    .delete()
    .eq("application_id", applicationId)
    .eq("document_id", documentId);
  if (error) return { error: error.message };

  revalidatePassportPaths(locale);
  revalidatePath(`/${locale}/applications/${applicationId}`);
  return {};
}

export interface SignedUrlResult {
  url?: string;
  error?: string;
}

/** Mints a short-lived signed URL for viewing/downloading one document's
 * current file. Never returns a public URL and never uses the service-role
 * client -- ownership is enforced by the same RLS-scoped query every other
 * Passport action uses. */
export async function getDocumentSignedUrlAction(documentId: string): Promise<SignedUrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: doc } = await supabase
    .from("application_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!doc?.storage_path) return { error: "No file uploaded yet." };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return { error: error?.message ?? "Could not generate a link." };

  return { url: data.signedUrl };
}
