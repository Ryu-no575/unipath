import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SourcePageType, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isHardBroken } from "@/app/lib/live-data/sourceStatus";

type Client = SupabaseClient<Database>;

export type SourceHealthLabel = "healthy" | "redirected" | "broken" | "needs_review" | "rejected";

export interface AdminSourceRow {
  id: string;
  url: string | null;
  universityId: string | null;
  universityName: string | null;
  programId: string | null;
  programName: string | null;
  pageType: SourcePageType | null;
  httpStatus: number | null;
  urlStatus: SourceUrlStatus;
  health: SourceHealthLabel;
  lastCheckedAt: string | null;
  lastSuccessfulCheckAt: string | null;
  adminRejected: boolean;
}

function classifyHealth(urlStatus: SourceUrlStatus, adminRejected: boolean): SourceHealthLabel {
  if (adminRejected) return "rejected";
  if (urlStatus === "valid") return "healthy";
  if (urlStatus === "redirected") return "redirected";
  if (isHardBroken(urlStatus)) return "broken";
  return "needs_review";
}

/** Official Source registry for /admin/sources (task brief item 13).
 * Excludes ROR registry-record sources -- those are provenance references
 * for where a university's base facts came from, not a page a student would
 * click (same exclusion app/lib/data/admin.ts's getSourceHealthStatus
 * already applies). */
export async function listAdminSources(supabase: Client): Promise<AdminSourceRow[]> {
  const { data: sources } = await supabase
    .from("sources")
    .select(
      "id, official_url, resolved_url, university_id, program_id, page_type, http_status, url_status, last_checked_at, last_successful_check_at, admin_rejected",
    )
    .neq("source_type", "ror")
    .order("last_checked_at", { ascending: false, nullsFirst: false });
  if (!sources || sources.length === 0) return [];

  const universityIds = new Set<string>();
  const programIds = new Set<string>();
  for (const s of sources) {
    if (s.university_id) universityIds.add(s.university_id);
    if (s.program_id) programIds.add(s.program_id);
  }

  const [{ data: universities }, { data: programs }] = await Promise.all([
    universityIds.size > 0
      ? supabase.from("universities").select("id, official_name").in("id", Array.from(universityIds))
      : Promise.resolve({ data: [] as { id: string; official_name: string }[] }),
    programIds.size > 0
      ? supabase.from("programs").select("id, official_name, university_id").in("id", Array.from(programIds))
      : Promise.resolve({ data: [] as { id: string; official_name: string; university_id: string }[] }),
  ]);

  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));
  const programById = new Map((programs ?? []).map((p) => [p.id, p]));

  return sources.map((s): AdminSourceRow => {
    const program = s.program_id ? programById.get(s.program_id) : undefined;
    const universityId = s.university_id ?? program?.university_id ?? null;
    return {
      id: s.id,
      url: s.resolved_url ?? s.official_url,
      universityId,
      universityName: universityId ? (universityNameById.get(universityId) ?? null) : null,
      programId: s.program_id,
      programName: program?.official_name ?? null,
      pageType: s.page_type,
      httpStatus: s.http_status,
      urlStatus: s.url_status,
      health: classifyHealth(s.url_status, s.admin_rejected),
      lastCheckedAt: s.last_checked_at,
      lastSuccessfulCheckAt: s.last_successful_check_at,
      adminRejected: s.admin_rejected,
    };
  });
}
