import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SourcePageType, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import type { Confidence } from "@/app/lib/live-data/extract";
import { resolveBestOfficialUrl, type OfficialSourceOutcome } from "@/app/lib/live-data/officialUrl";

type Client = SupabaseClient<Database>;

export interface SourceSummary {
  id: string;
  sourceType: string;
  officialUrl: string | null;
  resolvedUrl: string | null;
  urlStatus: SourceUrlStatus;
  publisher: string | null;
  pageType: SourcePageType | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  replacedBySourceId: string | null;
}

/** Official sources registered for a university/program/admission cycle
 * (each `sources` row points at at most one of the three -- see the
 * verified-live-data-system migration). Used to render "Official source /
 * Verified" on the application detail page. */
export async function getSourcesForEntities(
  supabase: Client,
  entities: { universityId: string | null; programId: string | null; admissionCycleId: string | null },
): Promise<SourceSummary[]> {
  const filters: string[] = [];
  if (entities.universityId) filters.push(`university_id.eq.${entities.universityId}`);
  if (entities.programId) filters.push(`program_id.eq.${entities.programId}`);
  if (entities.admissionCycleId) filters.push(`admission_cycle_id.eq.${entities.admissionCycleId}`);
  if (filters.length === 0) return [];

  const { data } = await supabase.from("sources").select("*").or(filters.join(","));

  return (data ?? []).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    officialUrl: row.official_url,
    resolvedUrl: row.resolved_url,
    urlStatus: row.url_status,
    publisher: row.publisher,
    pageType: row.page_type,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
    replacedBySourceId: row.replaced_by_source_id,
  }));
}

/** Picks the single best link to show as "Official source" out of every
 * source registered for an entity, following the Broken URL fallback chain
 * (see app/lib/live-data/officialUrl.ts) -- never a raw `officialUrl` that
 * might be a confirmed 404. */
export function pickBestOfficialSource(
  sources: SourceSummary[],
  fallbackWebsite: string | null = null,
): OfficialSourceOutcome {
  return resolveBestOfficialUrl(
    sources.map((s) => ({
      id: s.id,
      officialUrl: s.officialUrl,
      resolvedUrl: s.resolvedUrl,
      urlStatus: s.urlStatus,
      pageType: s.pageType,
      sourceType: s.sourceType,
      replacedBySourceId: s.replacedBySourceId,
    })),
    fallbackWebsite,
  );
}

export interface VerifiedField {
  fieldName: string;
  value: string;
  confidence: Confidence;
  sourceId: string;
  sourceUrl: string | null;
  retrievedAt: string;
}

/**
 * The most recently *extracted* value for each structured field found across
 * a set of sources (see app/lib/live-data/checkSource.ts), each carrying its
 * own source link, retrieval time, and confidence -- so a value can be shown
 * with "Source URL is always visible" (see AGENTS.md task notes on
 * Verification) even before anyone has manually applied it to the catalog
 * row itself. Returns nothing for a source that has never been checked; that
 * must render as unknown, not as a negative fact.
 */
export async function getVerifiedFieldsForSources(
  supabase: Client,
  sourceIds: string[],
): Promise<VerifiedField[]> {
  if (sourceIds.length === 0) return [];

  const { data: sources } = await supabase.from("sources").select("id, official_url").in("id", sourceIds);
  const urlBySourceId = new Map((sources ?? []).map((s) => [s.id, s.official_url]));

  const { data: snapshots } = await supabase
    .from("source_snapshots")
    .select("source_id, extracted_data, retrieved_at")
    .in("source_id", sourceIds)
    .order("retrieved_at", { ascending: false });

  const latestBySource = new Map<string, { extracted_data: Record<string, unknown>; retrieved_at: string }>();
  for (const snapshot of snapshots ?? []) {
    if (!latestBySource.has(snapshot.source_id)) latestBySource.set(snapshot.source_id, snapshot);
  }

  const fields: VerifiedField[] = [];
  for (const [sourceId, snapshot] of latestBySource) {
    const extracted = snapshot.extracted_data as Record<string, { value?: string; confidence?: string }>;
    for (const [fieldName, field] of Object.entries(extracted ?? {})) {
      if (!field?.value) continue;
      fields.push({
        fieldName,
        value: field.value,
        confidence: (field.confidence as Confidence) ?? "low",
        sourceId,
        sourceUrl: urlBySourceId.get(sourceId) ?? null,
        retrievedAt: snapshot.retrieved_at,
      });
    }
  }
  return fields;
}
