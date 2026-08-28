import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isVerifiedStatus } from "@/app/lib/live-data/sourceStatus";
import { computeProgramDataStatus, type DataStatus } from "./dataStatus";

type Client = SupabaseClient<Database>;

export interface AdminVerificationBadges {
  admissions: boolean;
  deadline: boolean;
  tuition: boolean;
  languageRequirement: boolean;
  portfolio: boolean;
  entranceExam: boolean;
}

export interface AdminProgramRow {
  id: string;
  universityId: string;
  universityName: string;
  programName: string;
  degreeType: string | null;
  field: string | null;
  language: string | null;
  duration: string | null;
  officialUrl: string | null;
  verifiedAt: string | null;
  needsReview: boolean;
  dataStatus: DataStatus;
  badges: AdminVerificationBadges;
}

/**
 * Program Review queue for /admin/programs (task brief item 12): every real
 * program plus, for its most recent admission cycle, whether each of the
 * fields the task brief calls out (Admissions/Deadline/Tuition/Language
 * requirement/Portfolio/Entrance exam) has actually been confirmed by a
 * reachable official source (page_type match, url_status verified, not
 * admin-rejected) or a high-confidence admission_requirements row --
 * "exists" is never treated as "verified" on its own.
 */
export async function listAdminPrograms(supabase: Client): Promise<AdminProgramRow[]> {
  const [{ data: programs }, { data: universities }] = await Promise.all([
    supabase.from("programs").select("*"),
    supabase.from("universities").select("id, official_name"),
  ]);
  if (!programs || programs.length === 0) return [];

  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));
  const programIds = programs.map((p) => p.id);

  const [{ data: cycles }, { data: programSources }] = await Promise.all([
    supabase.from("admission_cycles").select("*").in("program_id", programIds),
    supabase
      .from("sources")
      .select("program_id, admission_cycle_id, page_type, url_status, admin_rejected")
      .in("program_id", programIds)
      .neq("source_type", "ror"),
  ]);

  const cyclesByProgram = new Map<string, Database["public"]["Tables"]["admission_cycles"]["Row"][]>();
  for (const cycle of cycles ?? []) {
    const list = cyclesByProgram.get(cycle.program_id) ?? [];
    list.push(cycle);
    cyclesByProgram.set(cycle.program_id, list);
  }
  const latestCycleByProgram = new Map<string, Database["public"]["Tables"]["admission_cycles"]["Row"]>();
  for (const [programId, list] of cyclesByProgram) {
    latestCycleByProgram.set(programId, [...list].sort((a, b) => b.intake_year - a.intake_year)[0]);
  }

  const cycleIds = Array.from(latestCycleByProgram.values()).map((c) => c.id);
  type SourceSlice = { page_type: string | null; url_status: SourceUrlStatus; admin_rejected: boolean };
  const { data: cycleSources } =
    cycleIds.length > 0
      ? await supabase
          .from("sources")
          .select("admission_cycle_id, page_type, url_status, admin_rejected")
          .in("admission_cycle_id", cycleIds)
          .neq("source_type", "ror")
      : { data: [] as (SourceSlice & { admission_cycle_id: string | null })[] };

  const { data: requirements } =
    cycleIds.length > 0
      ? await supabase
          .from("admission_requirements")
          .select("admission_cycle_id, requirement_type, confidence")
          .in("admission_cycle_id", cycleIds)
      : { data: [] as { admission_cycle_id: string; requirement_type: string; confidence: string | null }[] };

  function hasVerifiedPageType(sources: SourceSlice[], pageTypes: string[]): boolean {
    return sources.some((s) => !s.admin_rejected && s.page_type && pageTypes.includes(s.page_type) && isVerifiedStatus(s.url_status));
  }
  function hasHighConfidenceRequirement(cycleId: string, requirementType: string): boolean {
    return (requirements ?? []).some((r) => r.admission_cycle_id === cycleId && r.requirement_type === requirementType && r.confidence === "high");
  }

  return programs
    .map((program): AdminProgramRow => {
      const cycle = latestCycleByProgram.get(program.id) ?? null;
      const ownProgramSources = (programSources ?? []).filter((s) => s.program_id === program.id);
      const ownCycleSources = cycle ? (cycleSources ?? []).filter((s) => s.admission_cycle_id === cycle.id) : [];
      const allSources = [...ownProgramSources, ...ownCycleSources];

      const badges: AdminVerificationBadges = {
        admissions: hasVerifiedPageType(allSources, ["admissions"]),
        deadline: Boolean(cycle?.application_deadline) && hasVerifiedPageType(allSources, ["admissions", "deadline"]),
        tuition: Boolean(cycle?.tuition != null) && hasVerifiedPageType(allSources, ["tuition", "admissions"]),
        languageRequirement:
          hasVerifiedPageType(allSources, ["language_requirement"]) ||
          (cycle ? hasHighConfidenceRequirement(cycle.id, "min_english_score") : false),
        portfolio: cycle ? hasHighConfidenceRequirement(cycle.id, "portfolio_requirement") : false,
        entranceExam: cycle ? hasHighConfidenceRequirement(cycle.id, "entrance_exam") : false,
      };

      return {
        id: program.id,
        universityId: program.university_id,
        universityName: universityNameById.get(program.university_id) ?? "Unknown university",
        programName: program.official_name,
        degreeType: program.degree_type,
        field: program.field,
        language: program.language,
        duration: program.duration,
        officialUrl: program.official_url,
        verifiedAt: program.verified_at,
        needsReview: program.needs_review,
        dataStatus: computeProgramDataStatus({
          verifiedAt: program.verified_at,
          needsReview: program.needs_review,
          officialUrl: program.official_url,
        }),
        badges,
      };
    })
    .sort((a, b) => a.universityName.localeCompare(b.universityName) || a.programName.localeCompare(b.programName));
}
