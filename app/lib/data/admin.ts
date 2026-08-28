import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isHardBroken, isVerifiedStatus } from "@/app/lib/live-data/sourceStatus";
import { getRealMatchCandidates } from "./match";

type Client = SupabaseClient<Database>;

export interface RealDataStatus {
  universitiesCount: number;
  /** Task brief item 5/25: universities with at least one confirmed
   * (non-ROR, url_status "valid"/"redirected", not admin-rejected) source --
   * see computeUniversityDataStatus in ./dataStatus. */
  verifiedUniversitiesCount: number;
  programsCount: number;
  programsVerifiedCount: number;
  /** Real admission_cycles rows with a verified application_deadline -- see
   * getVerifiedAdmissionsCount below for the exact definition (task brief
   * item 27's "Verified Admissions" milestone). */
  admissionsVerifiedCount: number;
  sourcesCount: number;
  sourcesCheckedLast24hCount: number;
  pendingChangesCount: number;
  simulatedChangeEventsCount: number;
  /** community_reports rows still awaiting admin review (task brief item 5
   * "Pending Reports"). */
  pendingReportsCount: number;
  /** user_custom_universities rows -- see the "Requested Universities"
   * design note in getRequestedUniversities below (task brief item 24). */
  requestedUniversitiesCount: number;
  /** MAX(universities.last_synced_at) -- task brief item 5 "Last university
   * sync". Null until the first `npm run sync:universities` run. */
  lastUniversitySyncAt: string | null;
  /** MAX(sources.last_checked_at) -- task brief item 5 "Last source
   * validation". Null until the first validation run. */
  lastSourceValidationAt: string | null;
  sourceHealth: SourceHealthStatus;
  /** Task brief item 34: "Coverage by Country" / "Coverage by Field" --
   * university count per country_code and program count per field, both
   * straight `group by` counts, sorted descending, never estimated. */
  coverageByCountry: { countryCode: string | null; count: number }[];
  coverageByField: { field: string | null; count: number }[];
}

export interface BrokenSourceRow {
  id: string;
  universityName: string;
  pageType: string | null;
  urlStatus: SourceUrlStatus;
  officialUrl: string | null;
  validationError: string | null;
  lastValidatedAt: string | null;
}

export interface SourceHealthStatus {
  total: number;
  healthy: number;
  redirected: number;
  broken: number;
  needsReview: number;
  brokenSources: BrokenSourceRow[];
}

const REVIEW_ONLY_STATUSES = new Set<SourceUrlStatus>(["blocked", "timeout"]);

/**
 * Source Health for the admin diagnostics page (see AGENTS.md task notes on
 * Source Health): counts every registered `sources` row (excluding ROR
 * registry-record sources, which are provenance references rather than
 * pages a student would click -- see app/lib/importers/ror/index.ts) by its
 * most recent validateSource() outcome. `unknown` (never yet validated)
 * counts toward `needsReview`, not `healthy` -- a source that's simply
 * unchecked has not earned "Healthy" yet.
 */
export async function getSourceHealthStatus(supabase: Client): Promise<SourceHealthStatus> {
  const { data } = await supabase
    .from("sources")
    .select(
      "id, page_type, url_status, official_url, validation_error, last_validated_at, source_type, university_id, program_id, admission_cycle_id, admin_rejected",
    )
    .neq("source_type", "ror");

  const rows = data ?? [];
  const universityIds = new Set<string>();
  const programIds = new Set<string>();
  const cycleIds = new Set<string>();
  for (const row of rows) {
    if (row.university_id) universityIds.add(row.university_id);
    if (row.program_id) programIds.add(row.program_id);
    if (row.admission_cycle_id) cycleIds.add(row.admission_cycle_id);
  }

  const [{ data: universities }, { data: programs }, { data: cycles }] = await Promise.all([
    universityIds.size > 0
      ? supabase.from("universities").select("id, official_name").in("id", Array.from(universityIds))
      : Promise.resolve({ data: [] as { id: string; official_name: string }[] }),
    programIds.size > 0
      ? supabase.from("programs").select("id, university_id").in("id", Array.from(programIds))
      : Promise.resolve({ data: [] as { id: string; university_id: string }[] }),
    cycleIds.size > 0
      ? supabase.from("admission_cycles").select("id, program_id").in("id", Array.from(cycleIds))
      : Promise.resolve({ data: [] as { id: string; program_id: string }[] }),
  ]);

  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));
  const universityIdByProgramId = new Map((programs ?? []).map((p) => [p.id, p.university_id]));
  const programIdByCycleId = new Map((cycles ?? []).map((c) => [c.id, c.program_id]));

  function universityNameFor(row: (typeof rows)[number]): string {
    if (row.university_id) return universityNameById.get(row.university_id) ?? "Unknown university";
    if (row.program_id) {
      const universityId = universityIdByProgramId.get(row.program_id);
      return (universityId && universityNameById.get(universityId)) ?? "Unknown university";
    }
    if (row.admission_cycle_id) {
      const programId = programIdByCycleId.get(row.admission_cycle_id);
      const universityId = programId ? universityIdByProgramId.get(programId) : null;
      return (universityId && universityNameById.get(universityId)) ?? "Unknown university";
    }
    return "Unknown university";
  }

  let healthy = 0;
  let redirected = 0;
  let broken = 0;
  let needsReview = 0;
  const brokenSources: BrokenSourceRow[] = [];

  for (const row of rows) {
    const status = row.url_status;
    // An admin-rejected source is never "Healthy" regardless of its
    // automated url_status -- see 20260829000000_admin_roles_v1.sql.
    if (row.admin_rejected) broken++;
    else if (status === "valid") healthy++;
    else if (status === "redirected") redirected++;
    else if (isHardBroken(status)) broken++;
    else needsReview++;

    if (row.admin_rejected || isHardBroken(status) || REVIEW_ONLY_STATUSES.has(status)) {
      brokenSources.push({
        id: row.id,
        universityName: universityNameFor(row),
        pageType: row.page_type,
        urlStatus: status,
        officialUrl: row.official_url,
        validationError: row.admin_rejected ? "Rejected by admin review." : row.validation_error,
        lastValidatedAt: row.last_validated_at,
      });
    }
  }

  return { total: rows.length, healthy, redirected, broken, needsReview, brokenSources };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Task brief item 27: an admission_cycles row counts as a Verified Admission
 * only when it has a real application_deadline AND at least one of its
 * program's own sources ('admissions' or 'deadline' page_type) has actually
 * been confirmed reachable (url_status = 'valid') -- never just because the
 * row exists. Deliberately does not require every field (tuition, fee,
 * language requirement) to be filled; each of those stays "Unknown"
 * independently when not confirmed (task brief item 27: "すべての値を埋める
 * 必要はありません").
 */
async function getVerifiedAdmissionsCount(supabase: Client): Promise<number> {
  const { data: cycles } = await supabase
    .from("admission_cycles")
    .select("id, program_id")
    .not("application_deadline", "is", null);
  if (!cycles || cycles.length === 0) return 0;

  const programIds = Array.from(new Set(cycles.map((c) => c.program_id)));
  const { data: sources } = await supabase
    .from("sources")
    .select("program_id, page_type, url_status")
    .in("program_id", programIds)
    .in("page_type", ["admissions", "deadline"])
    .eq("url_status", "valid");

  const verifiedProgramIds = new Set((sources ?? []).map((s) => s.program_id));
  return cycles.filter((c) => verifiedProgramIds.has(c.program_id)).length;
}

async function getCoverageByCountry(supabase: Client): Promise<{ countryCode: string | null; count: number }[]> {
  const { data } = await supabase.from("universities").select("country_code");
  const counts = new Map<string | null, number>();
  for (const row of data ?? []) {
    counts.set(row.country_code, (counts.get(row.country_code) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count);
}

async function getCoverageByField(supabase: Client): Promise<{ field: string | null; count: number }[]> {
  const { data } = await supabase.from("programs").select("field");
  const counts = new Map<string | null, number>();
  for (const row of data ?? []) {
    counts.set(row.field, (counts.get(row.field) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Task brief item 5/25 "Verified Universities": a university counts as
 * verified once at least one of its own sources, or one of its programs'
 * sources, actually confirmed reachable (url_status "valid"/"redirected",
 * see isVerifiedStatus) and has not been admin-rejected -- the same signal
 * app/lib/live-data/officialUrl.ts uses for the per-program "verified" badge,
 * just rolled up to the university level. Never derived from data_source
 * alone (ROR-only rows are "imported", not "verified" -- see
 * computeUniversityDataStatus in ./dataStatus).
 */
async function getVerifiedUniversitiesCount(supabase: Client): Promise<number> {
  const [{ data: universities }, { data: programs }, { data: sources }] = await Promise.all([
    supabase.from("universities").select("id"),
    supabase.from("programs").select("id, university_id"),
    supabase
      .from("sources")
      .select("university_id, program_id, url_status, admin_rejected")
      .neq("source_type", "ror"),
  ]);
  if (!universities || universities.length === 0) return 0;

  const universityIdByProgramId = new Map((programs ?? []).map((p) => [p.id, p.university_id]));
  const verifiedUniversityIds = new Set<string>();
  for (const source of sources ?? []) {
    if (source.admin_rejected || !isVerifiedStatus(source.url_status)) continue;
    const universityId = source.university_id ?? (source.program_id ? universityIdByProgramId.get(source.program_id) : null);
    if (universityId) verifiedUniversityIds.add(universityId);
  }

  return universities.filter((u) => verifiedUniversityIds.has(u.id)).length;
}

async function getLastUniversitySyncAt(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from("universities")
    .select("last_synced_at")
    .not("last_synced_at", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.last_synced_at ?? null;
}

async function getLastSourceValidationAt(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from("sources")
    .select("last_checked_at")
    .not("last_checked_at", "is", null)
    .order("last_checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.last_checked_at ?? null;
}

/**
 * Real Data Status for the Admin Dashboard (task brief item 5) -- every
 * number here is a live count against Supabase, never a cached or
 * hand-maintained figure.
 */
export async function getRealDataStatus(supabase: Client): Promise<RealDataStatus> {
  const since24h = new Date(Date.now() - ONE_DAY_MS).toISOString();

  const [
    { count: universitiesCount },
    { count: programsCount },
    { count: sourcesCount },
    { count: sourcesCheckedLast24hCount },
    { count: pendingChangesCount },
    { count: simulatedChangeEventsCount },
    { count: pendingReportsCount },
    { count: requestedUniversitiesCount },
    candidates,
    sourceHealth,
    admissionsVerifiedCount,
    verifiedUniversitiesCount,
    lastUniversitySyncAt,
    lastSourceValidationAt,
    coverageByCountry,
    coverageByField,
  ] = await Promise.all([
    supabase.from("universities").select("*", { count: "exact", head: true }),
    supabase.from("programs").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }).gte("last_checked_at", since24h),
    // change_events review_status starts at "pending_review" (see
    // app/lib/live-data/checkSource.ts) -- "detected" is a legacy/reserved
    // value not currently written by any path, counted here too so a future
    // writer of that status is still surfaced as pending.
    supabase
      .from("change_events")
      .select("*", { count: "exact", head: true })
      .in("review_status", ["detected", "pending_review"]),
    supabase.from("change_events").select("*", { count: "exact", head: true }).eq("is_simulated", true),
    supabase.from("community_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("user_custom_universities").select("*", { count: "exact", head: true }),
    getRealMatchCandidates(),
    getSourceHealthStatus(supabase),
    getVerifiedAdmissionsCount(supabase),
    getVerifiedUniversitiesCount(supabase),
    getLastUniversitySyncAt(supabase),
    getLastSourceValidationAt(supabase),
    getCoverageByCountry(supabase),
    getCoverageByField(supabase),
  ]);

  return {
    universitiesCount: universitiesCount ?? 0,
    verifiedUniversitiesCount,
    programsCount: programsCount ?? 0,
    programsVerifiedCount: candidates.filter((c) => c.verified).length,
    admissionsVerifiedCount,
    sourcesCount: sourcesCount ?? 0,
    sourcesCheckedLast24hCount: sourcesCheckedLast24hCount ?? 0,
    pendingChangesCount: pendingChangesCount ?? 0,
    simulatedChangeEventsCount: simulatedChangeEventsCount ?? 0,
    pendingReportsCount: pendingReportsCount ?? 0,
    requestedUniversitiesCount: requestedUniversitiesCount ?? 0,
    lastUniversitySyncAt,
    lastSourceValidationAt,
    sourceHealth,
    coverageByCountry,
    coverageByField,
  };
}
