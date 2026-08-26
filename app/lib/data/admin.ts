import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isHardBroken } from "@/app/lib/live-data/sourceStatus";
import { getRealMatchCandidates } from "./match";

type Client = SupabaseClient<Database>;

export interface RealDataStatus {
  universitiesCount: number;
  programsCount: number;
  programsVerifiedCount: number;
  sourcesCount: number;
  sourcesCheckedLast24hCount: number;
  pendingChangesCount: number;
  simulatedChangeEventsCount: number;
  sourceHealth: SourceHealthStatus;
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
      "id, page_type, url_status, official_url, validation_error, last_validated_at, source_type, university_id, program_id, admission_cycle_id",
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
    if (status === "valid") healthy++;
    else if (status === "redirected") redirected++;
    else if (isHardBroken(status)) broken++;
    else needsReview++;

    if (isHardBroken(status) || REVIEW_ONLY_STATUSES.has(status)) {
      brokenSources.push({
        id: row.id,
        universityName: universityNameFor(row),
        pageType: row.page_type,
        urlStatus: status,
        officialUrl: row.official_url,
        validationError: row.validation_error,
        lastValidatedAt: row.last_validated_at,
      });
    }
  }

  return { total: rows.length, healthy, redirected, broken, needsReview, brokenSources };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Real Data Status for the dev/admin diagnostics page (see AGENTS.md task
 * notes on Admin diagnostics) -- every number here is a live count against
 * Supabase, not a cached or hand-maintained figure.
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
    candidates,
    sourceHealth,
  ] = await Promise.all([
    supabase.from("universities").select("*", { count: "exact", head: true }),
    supabase.from("programs").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }).gte("last_checked_at", since24h),
    supabase.from("change_events").select("*", { count: "exact", head: true }).eq("review_status", "pending_review"),
    supabase.from("change_events").select("*", { count: "exact", head: true }).eq("is_simulated", true),
    getRealMatchCandidates(),
    getSourceHealthStatus(supabase),
  ]);

  return {
    universitiesCount: universitiesCount ?? 0,
    programsCount: programsCount ?? 0,
    programsVerifiedCount: candidates.filter((c) => c.verified).length,
    sourcesCount: sourcesCount ?? 0,
    sourcesCheckedLast24hCount: sourcesCheckedLast24hCount ?? 0,
    pendingChangesCount: pendingChangesCount ?? 0,
    simulatedChangeEventsCount: simulatedChangeEventsCount ?? 0,
    sourceHealth,
  };
}
