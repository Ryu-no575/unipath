import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/app/lib/supabase/admin";
import type { ChangeEntityType, Database } from "@/app/lib/supabase/database.types";
import { classifyChangeImportance } from "./importance";
import { fanOutNotificationsForChangeEvent } from "./notify";
import { extractStructuredData, normalizeHtml, type ExtractedFields } from "./extract";
import { validateSource } from "./validateSource";

/** Don't re-check the same source more than once per cooldown window --
 * respects the official site's resources even if something calls
 * checkSource() repeatedly (see AGENTS.md task notes on Crawling policy). */
const RECHECK_COOLDOWN_MS = 5 * 60 * 1000;

type SourceRow = Database["public"]["Tables"]["sources"]["Row"];

export type CheckSourceResult =
  | { status: "skipped_recent_check" }
  | { status: "skipped_disallowed" }
  | { status: "skipped_unsafe_url" }
  | { status: "fetch_failed"; error: string }
  | { status: "not_found" | "gone" | "invalid_domain"; error: string }
  | { status: "unchanged" }
  | { status: "changed"; changeEventIds: string[] };

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function resolveEntity(source: SourceRow): { entityType: ChangeEntityType; entityId: string } | null {
  if (source.university_id) return { entityType: "university", entityId: source.university_id };
  if (source.program_id) return { entityType: "program", entityId: source.program_id };
  if (source.admission_cycle_id) {
    return { entityType: "admission_cycle", entityId: source.admission_cycle_id };
  }
  return null;
}

/**
 * Validate the official page is actually reachable and on the right domain
 * (validateSource.ts), then -- only once that's confirmed -- extract
 * structured data, hash it, compare against the previous snapshot, and
 * record any changed fields as change_events. Server-only, service-role:
 * never called from a Client Component, and only ever fetches
 * `sources.official_url` for a source that already exists in the database --
 * there is no code path that accepts a URL from the client (see
 * app/lib/live-data/ssrf.ts for the SSRF guard on that stored URL).
 */
export async function checkSource(sourceId: string): Promise<CheckSourceResult> {
  const supabase = createAdminClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (sourceError || !source || !source.official_url) {
    return { status: "fetch_failed", error: sourceError?.message ?? "Source not found or has no official_url." };
  }

  if (source.last_checked_at) {
    const elapsed = Date.now() - new Date(source.last_checked_at).getTime();
    if (elapsed < RECHECK_COOLDOWN_MS) return { status: "skipped_recent_check" };
  }

  const validation = await validateSource(sourceId);

  if (validation.status === "not_found" || validation.status === "gone" || validation.status === "invalid_domain") {
    return { status: validation.status, error: validation.validationError ?? validation.status };
  }
  if (validation.validationError === "URL failed safety checks.") return { status: "skipped_unsafe_url" };
  if (validation.validationError === "Disallowed by robots.txt.") return { status: "skipped_disallowed" };
  if (!validation.html) {
    return { status: "fetch_failed", error: validation.validationError ?? `Could not verify the official page (${validation.status}).` };
  }

  const html = validation.html;

  // Normalize before both hashing and extraction: hashing the visible text
  // (not raw HTML) means incidental markup churn -- ad slots, inline
  // timestamps, attribute order -- never registers as a false "changed".
  const normalizedText = normalizeHtml(html);
  const extractedData = extractStructuredData(normalizedText);
  const contentHash = hashContent(normalizedText);

  const { data: previousSnapshot } = await supabase
    .from("source_snapshots")
    .select("*")
    .eq("source_id", sourceId)
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("source_snapshots").insert({
    source_id: sourceId,
    content_hash: contentHash,
    extracted_data: extractedData,
    retrieved_at: new Date().toISOString(),
  });

  if (!previousSnapshot) {
    // First-ever check: nothing to diff against yet.
    return { status: "unchanged" };
  }
  if (previousSnapshot.content_hash === contentHash) {
    return { status: "unchanged" };
  }

  const entity = resolveEntity(source);
  if (!entity) return { status: "unchanged" };

  const previousData = (previousSnapshot.extracted_data ?? {}) as ExtractedFields;
  const fieldNames = new Set([...Object.keys(extractedData), ...Object.keys(previousData)]);

  const fieldChanges: { fieldName: string; oldValue: string | null; newValue: string | null; changeType: "value_changed" | "added" | "removed" }[] = [];
  for (const fieldName of fieldNames) {
    const before = previousData[fieldName]?.value ?? null;
    const after = extractedData[fieldName]?.value ?? null;
    if (before === after) continue;
    const changeType = before == null ? "added" : after == null ? "removed" : "value_changed";
    fieldChanges.push({ fieldName, oldValue: before, newValue: after, changeType });
  }

  // No per-field difference detected (e.g. the change is in prose the v1
  // extractors don't parse) but the normalized page text did change -- still
  // record that as a fallback so a real edit shows up for review rather than
  // being silently dropped.
  if (fieldChanges.length === 0) {
    fieldChanges.push({ fieldName: "page_content", oldValue: null, newValue: null, changeType: "value_changed" });
  }

  const changeEventIds: string[] = [];
  for (const change of fieldChanges) {
    const { data: changeEvent, error } = await supabase
      .from("change_events")
      .insert({
        source_id: sourceId,
        entity_type: entity.entityType,
        entity_id: entity.entityId,
        field_name: change.fieldName,
        old_value: change.oldValue,
        new_value: change.newValue,
        change_type: change.changeType,
        importance: classifyChangeImportance(change.fieldName),
        review_status: "pending_review",
      })
      .select("id")
      .single();
    if (!error && changeEvent) changeEventIds.push(changeEvent.id);
  }

  for (const id of changeEventIds) {
    await fanOutNotificationsForChangeEvent(id);
  }

  return { status: "changed", changeEventIds };
}
