import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { fieldLabel } from "@/app/lib/live-data/field-labels";

type Client = SupabaseClient<Database>;
type ChangeEventRow = Database["public"]["Tables"]["change_events"]["Row"];

export interface AdminChangeEventRow {
  id: string;
  entityType: ChangeEventRow["entity_type"];
  entityId: string;
  /** Best-effort human label for the entity this change is about --
   * "<University> — <Program>" when resolvable, falling back to the raw id
   * when the row it points at no longer exists. */
  entityLabel: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: ChangeEventRow["change_type"];
  importance: ChangeEventRow["importance"];
  reviewStatus: ChangeEventRow["review_status"];
  isSimulated: boolean;
  detectedAt: string;
  sourceUrl: string | null;
  sourceId: string | null;
}

/** Pending review queue for /admin/changes (task brief item 14): every
 * change_events row an admin still needs to Approve or Reject. Resolves
 * entity labels via a handful of batched lookups rather than one query per
 * row -- the same N-query-not-per-row approach app/lib/data/match.ts uses,
 * appropriate at this catalog's size. */
export async function listPendingChangeEvents(supabase: Client): Promise<AdminChangeEventRow[]> {
  const { data: changes } = await supabase
    .from("change_events")
    .select("*")
    .in("review_status", ["detected", "pending_review"])
    .order("detected_at", { ascending: false });
  if (!changes || changes.length === 0) return [];

  return attachEntityLabels(supabase, changes);
}

export async function listRecentChangeEvents(supabase: Client, limit = 30): Promise<AdminChangeEventRow[]> {
  const { data: changes } = await supabase
    .from("change_events")
    .select("*")
    .in("review_status", ["approved", "applied", "rejected"])
    .order("detected_at", { ascending: false })
    .limit(limit);
  if (!changes || changes.length === 0) return [];

  return attachEntityLabels(supabase, changes);
}

async function attachEntityLabels(supabase: Client, changes: ChangeEventRow[]): Promise<AdminChangeEventRow[]> {
  const universityIds = new Set<string>();
  const programIds = new Set<string>();
  const cycleIds = new Set<string>();
  const sourceIds = new Set<string>();
  for (const c of changes) {
    if (c.entity_type === "university") universityIds.add(c.entity_id);
    if (c.entity_type === "program") programIds.add(c.entity_id);
    if (c.entity_type === "admission_cycle") cycleIds.add(c.entity_id);
    if (c.source_id) sourceIds.add(c.source_id);
  }

  const [{ data: cycles }] = await Promise.all([
    cycleIds.size > 0
      ? supabase.from("admission_cycles").select("id, program_id").in("id", Array.from(cycleIds))
      : Promise.resolve({ data: [] as { id: string; program_id: string }[] }),
  ]);
  for (const cycle of cycles ?? []) programIds.add(cycle.program_id);
  const programIdByCycleId = new Map((cycles ?? []).map((c) => [c.id, c.program_id]));

  const { data: programs } =
    programIds.size > 0
      ? await supabase.from("programs").select("id, official_name, university_id").in("id", Array.from(programIds))
      : { data: [] as { id: string; official_name: string; university_id: string }[] };
  for (const p of programs ?? []) universityIds.add(p.university_id);
  const programById = new Map((programs ?? []).map((p) => [p.id, p]));

  const { data: universities } =
    universityIds.size > 0
      ? await supabase.from("universities").select("id, official_name").in("id", Array.from(universityIds))
      : { data: [] as { id: string; official_name: string }[] };
  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));

  const { data: sources } =
    sourceIds.size > 0
      ? await supabase.from("sources").select("id, official_url, resolved_url").in("id", Array.from(sourceIds))
      : { data: [] as { id: string; official_url: string | null; resolved_url: string | null }[] };
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));

  function labelFor(change: ChangeEventRow): string {
    if (change.entity_type === "university") {
      return universityNameById.get(change.entity_id) ?? "Unknown university";
    }
    if (change.entity_type === "program") {
      const program = programById.get(change.entity_id);
      const universityName = program ? universityNameById.get(program.university_id) : undefined;
      return program ? `${universityName ?? "Unknown university"} — ${program.official_name}` : "Unknown program";
    }
    const programId = programIdByCycleId.get(change.entity_id);
    const program = programId ? programById.get(programId) : undefined;
    const universityName = program ? universityNameById.get(program.university_id) : undefined;
    return program ? `${universityName ?? "Unknown university"} — ${program.official_name}` : "Unknown admission cycle";
  }

  return changes.map((c) => {
    const source = c.source_id ? sourceById.get(c.source_id) : undefined;
    return {
      id: c.id,
      entityType: c.entity_type,
      entityId: c.entity_id,
      entityLabel: labelFor(c),
      fieldName: c.field_name,
      fieldLabel: fieldLabel(c.field_name),
      oldValue: c.old_value,
      newValue: c.new_value,
      changeType: c.change_type,
      importance: c.importance,
      reviewStatus: c.review_status,
      isSimulated: c.is_simulated,
      detectedAt: c.detected_at,
      sourceUrl: source ? (source.resolved_url ?? source.official_url) : null,
      sourceId: c.source_id,
    };
  });
}

const UNIVERSITY_COLUMNS = new Set(["official_name", "country_code", "city", "official_website", "founded_year"]);
const PROGRAM_COLUMNS = new Set(["official_name", "degree_type", "field", "language", "duration", "official_url"]);
const ADMISSION_CYCLE_NUMERIC_COLUMNS = new Set(["tuition", "application_fee"]);
const ADMISSION_CYCLE_TEXT_COLUMNS = new Set(["tuition_currency", "application_fee_currency", "deadline_timezone"]);
const ADMISSION_CYCLE_DATE_COLUMNS = new Set(["application_deadline", "application_open_date"]);

function parseNumeric(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned.length > 0 ? n : null;
}

function parseDateIso(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Applies an approved change_event's new_value to the live catalog row it
 * describes (task brief item 14's "detected -> admin review -> approved ->
 * official current data update"). Direct universities/programs/admission_cycles
 * columns are updated in place; every other field_name (English requirement,
 * entrance exam, portfolio, ...) upserts an `admission_requirements` row
 * instead, since those were never columns to begin with -- see
 * app/lib/live-data/extract.ts for the exact field_name vocabulary this
 * switches on. Never guesses when a value can't be safely coerced (e.g. an
 * unparsable date): the write is skipped and `applied: false` is returned so
 * the caller can surface that instead of silently corrupting the catalog.
 */
export async function applyApprovedChange(
  supabase: Client,
  change: ChangeEventRow,
): Promise<{ applied: boolean; reason?: string }> {
  if (change.new_value == null) return { applied: true }; // e.g. "page_content" fallback: nothing structured to write.

  // Supabase's generated Update types reject a computed (dynamic) key, since
  // they can't verify it's one of the table's real columns at compile time --
  // UNIVERSITY_COLUMNS/PROGRAM_COLUMNS/ADMISSION_CYCLE_*_COLUMNS are exactly
  // that runtime verification, so the cast below is safe: every field_name
  // reaching `.update()` here has already been checked against the table's
  // real column names.
  function patchOf(value: string | number): Record<string, string | number> {
    return { [change.field_name]: value };
  }

  if (change.entity_type === "university" && UNIVERSITY_COLUMNS.has(change.field_name)) {
    const value = change.field_name === "founded_year" ? parseNumeric(change.new_value) : change.new_value;
    if (value == null) return { applied: false, reason: "Could not parse new_value for founded_year." };
    const { error } = await supabase.from("universities").update(patchOf(value) as never).eq("id", change.entity_id);
    return error ? { applied: false, reason: error.message } : { applied: true };
  }

  if (change.entity_type === "program" && PROGRAM_COLUMNS.has(change.field_name)) {
    const { error } = await supabase.from("programs").update(patchOf(change.new_value) as never).eq("id", change.entity_id);
    return error ? { applied: false, reason: error.message } : { applied: true };
  }

  if (change.entity_type === "admission_cycle") {
    if (ADMISSION_CYCLE_NUMERIC_COLUMNS.has(change.field_name)) {
      const value = parseNumeric(change.new_value);
      if (value == null) return { applied: false, reason: `Could not parse numeric value for ${change.field_name}.` };
      const { error } = await supabase.from("admission_cycles").update(patchOf(value) as never).eq("id", change.entity_id);
      return error ? { applied: false, reason: error.message } : { applied: true };
    }
    if (ADMISSION_CYCLE_TEXT_COLUMNS.has(change.field_name)) {
      const { error } = await supabase.from("admission_cycles").update(patchOf(change.new_value) as never).eq("id", change.entity_id);
      return error ? { applied: false, reason: error.message } : { applied: true };
    }
    if (ADMISSION_CYCLE_DATE_COLUMNS.has(change.field_name)) {
      const iso = parseDateIso(change.new_value);
      if (!iso) return { applied: false, reason: `Could not parse date value for ${change.field_name}.` };
      const { error } = await supabase.from("admission_cycles").update(patchOf(iso) as never).eq("id", change.entity_id);
      return error ? { applied: false, reason: error.message } : { applied: true };
    }

    // Not a direct column (English requirement, entrance exam, portfolio,
    // scholarship, eligibility, required documents, ...) -- record it as an
    // admission_requirements fact instead, keyed by field_name.
    const { data: existing } = await supabase
      .from("admission_requirements")
      .select("id")
      .eq("admission_cycle_id", change.entity_id)
      .eq("requirement_type", change.field_name)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("admission_requirements")
        .update({ minimum_value: change.new_value, source_id: change.source_id, confidence: "high" })
        .eq("id", existing.id);
      return error ? { applied: false, reason: error.message } : { applied: true };
    }

    const { error } = await supabase.from("admission_requirements").insert({
      admission_cycle_id: change.entity_id,
      requirement_type: change.field_name,
      title: fieldLabel(change.field_name),
      minimum_value: change.new_value,
      source_id: change.source_id,
      confidence: "high",
    });
    return error ? { applied: false, reason: error.message } : { applied: true };
  }

  return { applied: false, reason: `No apply rule for ${change.entity_type}.${change.field_name}.` };
}
