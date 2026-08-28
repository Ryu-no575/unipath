/**
 * Server-side ROR (Research Organization Registry) importer -- the
 * `universities` Primary Source for Real University Data v1 (see AGENTS.md
 * task notes on Real University Data). Never invents a university's fields;
 * every value written here comes straight from ROR's own record for the
 * matched organization.
 *
 * Deliberately does NOT `import "server-only"`: that marker only resolves
 * inside Next's webpack build (it aliases to an internal stub -- see
 * next/dist/build/webpack-config.js), so a file that imports it cannot also
 * run as a plain Node script. This module is intentionally dual-mode --
 * `npm run import:universities` executes it directly via `node` (see
 * scripts/import-universities.ts), and it may also be called from
 * server-only app code later (e.g. an admin "sync now" action). Callers on
 * the app side are responsible for never importing this from a Client
 * Component; nothing here does browser-unsafe work by itself (it just takes
 * a Supabase client and makes fetch calls), so there is no runtime guard to
 * enforce that -- only convention.
 *
 * Client Components must never call the ROR API directly or import this
 * module -- see app/api/universities/search/route.ts for the one place a
 * live, unpersisted ROR lookup is exposed to the browser (search-as-you-type
 * for a university not yet in the catalog), which is unrelated to this
 * importer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/database.types";

type Client = SupabaseClient<Database>;

const ROR_API_URL = "https://api.ror.org/v2/organizations";
const REQUEST_TIMEOUT_MS = 10000;
/** Be polite to ROR's public API when importing a whole list in one run. */
const BETWEEN_REQUESTS_MS = 300;

interface RorName {
  value: string;
  lang: string | null;
  types: string[];
}

interface RorLink {
  type: string;
  value: string;
}

interface RorGeonamesDetails {
  name?: string;
  country_name?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
}

interface RorLocation {
  geonames_id?: number;
  geonames_details?: RorGeonamesDetails;
}

export interface RorItem {
  id: string;
  names: RorName[];
  types: string[];
  status?: string;
  links: RorLink[];
  established: number | null;
  locations: RorLocation[];
}

interface RorSearchResponse {
  number_of_results: number;
  items: RorItem[];
}

/**
 * Heuristic quality filter for "is this a Higher Education Institution
 * someone would apply to as an overseas study destination" (see AGENTS.md
 * task notes: "研究所や病院などをMatchに出さないでください"). ROR's own `types` field is too
 * coarse for this -- "education" covers everything from a K-12 gymnasium to
 * MIT -- so this is name-pattern based and imperfect by construction. It
 * errs toward excluding: a name matching neither list is rejected, not
 * accepted by default, since a wrongly-excluded university just doesn't get
 * imported this round (fixable by broadening the pattern later), while a
 * wrongly-included hospital or primary school would show up in Match
 * Results, which is the worse failure mode.
 */
export const HEI_QUALIFY_PATTERN =
  /\buniversit(y|ies|e|ät|à|é|eit|aria|arios)\b|\bpolytechnic\b|\bpolitecnico\b|\binstitute[s]? of technology\b|\btechnische (universität|hochschule)\b|\bhochschule\b|\bfachhochschule\b|\bcollege\b|\buniversité\b|\buniversidad\b|\buniversiteit\b|\bécole (polytechnique|normale|centrale|des mines|nationale)\b|\bgrande[s]? école\b|\binstituto (superior|politécnico|tecnológico|universitario)\b|\bconservator(y|io|iu?m)\b|\bgraduate school\b|\bbusiness school\b|\bschool of (management|business|law|medicine|engineering|design|art|music)\b/i;

export const HEI_DISQUALIFY_PATTERN =
  /\bhospital\b|\bklinik\b|\bclinic\b|\bmedical (center|centre)\b|\bgymnasium\b|\bgrundschule\b|\bprimary school\b|\belementary school\b|\bmiddle school\b|\b(junior|senior) high school\b|\bhigh school\b|\bkindergarten\b|\bpreschool\b|\bmontessori\b|\bberufsschule\b|\bvocational school\b|\bresearch (institute|center|centre)\b|\blaborator(y|ies)\b|\bacademy of sciences\b|\bnational laboratory\b|\bmuseum\b|\bobservatory\b/i;

/**
 * Name-only version of the qualify/disqualify heuristic above, for
 * re-screening a university row already in the catalog (no ROR `types`/
 * `status` fields available at that point -- see
 * scripts/verify-universities.ts's Bad Data Detection pass). Deliberately
 * conservative in the same direction as isLikelyHigherEducationInstitution:
 * "qualifies" is true whenever the disqualify pattern doesn't match, since a
 * name with neither pattern (e.g. a short acronym ROR sometimes returns as
 * the display name) is ambiguous, not disqualified.
 */
export function classifyInstitutionNamePattern(name: string): "qualifies" | "disqualifies" | "ambiguous" {
  if (HEI_DISQUALIFY_PATTERN.test(name)) return "disqualifies";
  if (HEI_QUALIFY_PATTERN.test(name)) return "qualifies";
  return "ambiguous";
}

export function isLikelyHigherEducationInstitution(item: RorItem): boolean {
  if (item.status && item.status !== "active") return false;
  if (!(item.types ?? []).includes("education")) return false;

  const names = (item.names ?? []).map((n) => n.value);
  const qualifies = names.some((n) => HEI_QUALIFY_PATTERN.test(n));
  const disqualifies = names.some((n) => HEI_DISQUALIFY_PATTERN.test(n));
  return qualifies && !disqualifies;
}

export interface NormalizedUniversity {
  rorId: string;
  officialName: string;
  countryCode: string | null;
  city: string | null;
  officialWebsite: string | null;
  foundedYear: number | null;
  latitude: number | null;
  longitude: number | null;
}

function pickDisplayName(names: RorName[]): string {
  const display = names.find((entry) => entry.types.includes("ror_display"));
  if (display) return display.value;
  const label = names.find((entry) => entry.types.includes("label"));
  if (label) return label.value;
  return names[0]?.value ?? "Unknown institution";
}

function pickWebsite(links: RorLink[]): string | null {
  return links.find((link) => link.type === "website")?.value ?? null;
}

export function normalizeRorItem(item: RorItem): NormalizedUniversity {
  const details = item.locations?.[0]?.geonames_details;
  return {
    rorId: item.id,
    officialName: pickDisplayName(item.names ?? []),
    countryCode: details?.country_code?.toUpperCase() ?? null,
    city: details?.name ?? null,
    officialWebsite: pickWebsite(item.links ?? []),
    foundedYear: item.established ?? null,
    latitude: typeof details?.lat === "number" ? details.lat : null,
    longitude: typeof details?.lng === "number" ? details.lng : null,
  };
}

/**
 * Finds the best ROR match for a human-entered institution name. Prefers an
 * exact (case-insensitive) name match among the results; otherwise falls
 * back to ROR's own top-ranked result for the query. Returns null if ROR has
 * no education organization matching the query at all -- callers must
 * report that as "not found", never invent a result.
 */
export async function searchRorOrganization(query: string): Promise<RorItem | null> {
  const url = new URL(ROR_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("filter", "types:education");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`ROR API returned HTTP ${response.status} for query "${query}"`);
  }

  const data = (await response.json()) as RorSearchResponse;
  const items = data.items ?? [];
  if (items.length === 0) return null;

  const exact = items.find((item) =>
    (item.names ?? []).some((name) => name.value.toLowerCase() === query.trim().toLowerCase()),
  );
  return exact ?? items[0];
}

/**
 * One page of ROR's education organizations for a given country -- the
 * building block for `importUniversitiesForCountry` below. Never hardcodes
 * which institutions exist; `countryCode` and `page` are the only inputs,
 * so which universities get returned is entirely up to ROR's own data for
 * that country (see AGENTS.md task notes: "特定大学名を100件hardcodeする方式ではなく、
 * query / country / institution type等から取得できるようにしてください").
 */
export async function searchRorOrganizationsByCountry(countryCode: string, page: number): Promise<RorItem[]> {
  const url = new URL(ROR_API_URL);
  url.searchParams.set(
    "filter",
    `types:education,locations.geonames_details.country_code:${countryCode},status:active`,
  );
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`ROR API returned HTTP ${response.status} for country "${countryCode}" page ${page}`);
  }

  const data = (await response.json()) as RorSearchResponse;
  return data.items ?? [];
}

export type UpsertStatus = "imported" | "updated" | "skipped" | "error";

export interface UpsertResult {
  status: UpsertStatus;
  query: string;
  rorId?: string;
  officialName?: string;
  universityId?: string;
  error?: string;
}

type UniversityRow = Database["public"]["Tables"]["universities"]["Row"];

function hasChanged(existing: UniversityRow, normalized: NormalizedUniversity): boolean {
  return (
    existing.official_name !== normalized.officialName ||
    existing.country_code !== normalized.countryCode ||
    existing.city !== normalized.city ||
    existing.official_website !== normalized.officialWebsite ||
    existing.founded_year !== normalized.foundedYear ||
    existing.latitude !== normalized.latitude ||
    existing.longitude !== normalized.longitude
  );
}

/**
 * Registers (or reuses) two "university" page_type sources for a catalog
 * university: a ROR registry-record reference (provenance -- exempt from
 * domain validation and never offered as the clickable Official Source, see
 * app/lib/live-data/officialUrl.ts) and, when ROR has a website link for it,
 * the actual official_website source that Source Validation and the fallback
 * chain operate on. Without the latter, a bulk-imported university would
 * have no source Source Health could ever mark Healthy.
 */
async function ensureUniversitySources(
  supabase: Client,
  universityId: string,
  recordUrl: string,
  officialWebsite: string | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from("sources")
    .select("id, source_type")
    .eq("university_id", universityId)
    .eq("page_type", "university");
  const existingTypes = new Set((existing ?? []).map((s) => s.source_type));

  if (!existingTypes.has("ror")) {
    await supabase.from("sources").insert({
      source_type: "ror",
      official_url: recordUrl,
      publisher: "Research Organization Registry (ROR)",
      page_type: "university",
      university_id: universityId,
      verified_at: new Date().toISOString(),
    });
  }

  if (officialWebsite && !existingTypes.has("official_website")) {
    await supabase.from("sources").insert({
      source_type: "official_website",
      official_url: officialWebsite,
      page_type: "university",
      university_id: universityId,
    });
  }
}

/**
 * Upserts one normalized ROR record into `public.universities`, keyed by
 * `ror_id` so re-running an import never creates a duplicate row. Falls back
 * to matching an existing row by exact official_name where `ror_id is null`
 * -- this is what lets a university that was manually seeded before this
 * importer existed (e.g. Politecnico di Milano via
 * scripts/register-poc-source.mjs) get backfilled with its real ROR id
 * instead of being duplicated.
 */
export async function upsertUniversityFromRor(
  supabase: Client,
  normalized: NormalizedUniversity,
): Promise<UpsertResult> {
  // ROR v2's `id` field is already the full https://ror.org/<id> record URL.
  const recordUrl = normalized.rorId;
  const now = new Date().toISOString();

  const { data: byRorId, error: byRorIdError } = await supabase
    .from("universities")
    .select("*")
    .eq("ror_id", normalized.rorId)
    .maybeSingle();
  if (byRorIdError) {
    return { status: "error", query: normalized.officialName, error: byRorIdError.message };
  }

  let existing: UniversityRow | null = byRorId ?? null;
  if (!existing) {
    const { data: byName, error: byNameError } = await supabase
      .from("universities")
      .select("*")
      .is("ror_id", null)
      .ilike("official_name", normalized.officialName)
      .maybeSingle();
    if (byNameError) {
      return { status: "error", query: normalized.officialName, error: byNameError.message };
    }
    existing = byName ?? null;
  }

  if (!existing) {
    const { data, error } = await supabase
      .from("universities")
      .insert({
        ror_id: normalized.rorId,
        official_name: normalized.officialName,
        country_code: normalized.countryCode,
        city: normalized.city,
        official_website: normalized.officialWebsite,
        founded_year: normalized.foundedYear,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        data_source: "ror",
        source_url: recordUrl,
        last_synced_at: now,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { status: "error", query: normalized.officialName, error: error?.message ?? "Insert failed" };
    }

    await ensureUniversitySources(supabase, data.id, recordUrl, normalized.officialWebsite);
    return {
      status: "imported",
      query: normalized.officialName,
      rorId: normalized.rorId,
      officialName: normalized.officialName,
      universityId: data.id,
    };
  }

  const changed = existing.ror_id !== normalized.rorId || hasChanged(existing, normalized);

  if (!changed) {
    await supabase.from("universities").update({ last_synced_at: now }).eq("id", existing.id);
    await ensureUniversitySources(supabase, existing.id, recordUrl, normalized.officialWebsite);
    return {
      status: "skipped",
      query: normalized.officialName,
      rorId: normalized.rorId,
      officialName: normalized.officialName,
      universityId: existing.id,
    };
  }

  const { error: updateError } = await supabase
    .from("universities")
    .update({
      ror_id: normalized.rorId,
      official_name: normalized.officialName,
      country_code: normalized.countryCode,
      city: normalized.city,
      official_website: normalized.officialWebsite,
      founded_year: normalized.foundedYear,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      data_source: "ror",
      source_url: recordUrl,
      last_synced_at: now,
    })
    .eq("id", existing.id);
  if (updateError) {
    return { status: "error", query: normalized.officialName, error: updateError.message };
  }

  await ensureUniversitySources(supabase, existing.id, recordUrl, normalized.officialWebsite);
  return {
    status: "updated",
    query: normalized.officialName,
    rorId: normalized.rorId,
    officialName: normalized.officialName,
    universityId: existing.id,
  };
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  results: UpsertResult[];
}

/**
 * Looks up each name in ROR and upserts the match into `universities`. Names
 * are only search input -- every field actually written comes from ROR's
 * response for whichever organization it resolves the query to, never from
 * the name list itself.
 */
export async function importUniversitiesByName(
  supabase: Client,
  names: string[],
): Promise<ImportSummary> {
  const results: UpsertResult[] = [];

  for (const name of names) {
    try {
      const match = await searchRorOrganization(name);
      if (!match) {
        results.push({ status: "error", query: name, error: "No ROR education organization found for this name." });
      } else {
        const normalized = normalizeRorItem(match);
        results.push(await upsertUniversityFromRor(supabase, normalized));
      }
    } catch (err) {
      results.push({ status: "error", query: name, error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_REQUESTS_MS));
  }

  return {
    imported: results.filter((r) => r.status === "imported").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

const MAX_PAGES_PER_COUNTRY = 6; // 6 * 20 = up to 120 candidates scanned per country before giving up.

/**
 * Pages through ROR's education organizations for one country, keeping only
 * the ones that pass `isLikelyHigherEducationInstitution`, and upserts up to
 * `perCountryCap` of them. This -- not a hardcoded institution-name list --
 * is the real scale-up path: which universities exist for a country comes
 * entirely from ROR's own data (see AGENTS.md task notes: "「大学名だけ大量に
 * hardcodeする」は禁止です").
 */
export async function importUniversitiesForCountry(
  supabase: Client,
  countryCode: string,
  perCountryCap: number,
): Promise<ImportSummary> {
  const results: UpsertResult[] = [];
  let imported = 0;

  for (let page = 1; page <= MAX_PAGES_PER_COUNTRY && imported < perCountryCap; page++) {
    let items: RorItem[];
    try {
      items = await searchRorOrganizationsByCountry(countryCode, page);
    } catch (err) {
      results.push({ status: "error", query: `${countryCode} page ${page}`, error: err instanceof Error ? err.message : String(err) });
      break;
    }
    if (items.length === 0) break;

    for (const item of items) {
      if (imported >= perCountryCap) break;
      if (!isLikelyHigherEducationInstitution(item)) continue;

      const normalized = normalizeRorItem(item);
      const result = await upsertUniversityFromRor(supabase, normalized);
      results.push(result);
      if (result.status === "imported" || result.status === "updated") imported++;
    }

    await new Promise((resolve) => setTimeout(resolve, BETWEEN_REQUESTS_MS));
  }

  return {
    imported: results.filter((r) => r.status === "imported").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

/**
 * World-scale importer entry point (see AGENTS.md task notes: "対象地域は
 * 特定地域に固定しないでください。世界中を扱えるarchitectureにしてください"): takes an arbitrary list
 * of ISO country codes -- not baked into this function -- and imports up to
 * `perCountryCap` real, ROR-verified higher-education institutions from
 * each, stopping early once `targetTotal` net-new/updated universities have
 * been reached. The specific country list is the caller's choice (see
 * scripts/import-universities.ts for the default seed spanning Europe, the
 * US, Canada, the UK, Australia, and Asia -- a starting point, not a limit
 * on what this function can accept).
 */
export async function importUniversitiesForCountries(
  supabase: Client,
  countryCodes: string[],
  targetTotal: number,
  perCountryCap: number,
): Promise<ImportSummary> {
  const results: UpsertResult[] = [];
  let total = 0;

  for (const countryCode of countryCodes) {
    if (total >= targetTotal) break;
    const remaining = targetTotal - total;
    const summary = await importUniversitiesForCountry(supabase, countryCode, Math.min(perCountryCap, remaining));
    results.push(...summary.results);
    total += summary.imported + summary.updated;
  }

  return {
    imported: results.filter((r) => r.status === "imported").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}
