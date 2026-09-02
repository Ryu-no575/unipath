import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { parseEnglishScore } from "@/app/lib/routes/context";
import type { CatalogProgramCandidate } from "@/app/lib/eligibility/catalogEligibility";
import type { UserCredentials } from "@/app/lib/eligibility/types";

type Client = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Builds the user's real, self-reported credential set for the Eligibility
 * Engine straight from their profile -- the same single source of truth the
 * Route engine's gap analysis already uses for English (see
 * app/lib/routes/context.ts), so the two engines never disagree about "what
 * is the user's current English score". GPA/qualification type come
 * directly off `profiles` (the primary entry) -- additional
 * `education_history` rows aren't factored in here, matching how
 * `profiles.education_level`/`gpa_value` are already treated as *the*
 * primary academic record elsewhere in Passport. */
export function profileToUserCredentials(
  profile: Pick<ProfileRow, "english_test_type" | "english_test_score" | "gpa_value" | "gpa_scale" | "qualification_type">,
): UserCredentials {
  return {
    englishScore:
      profile.english_test_type && profile.english_test_type !== "none"
        ? parseEnglishScore(profile.english_test_score)
        : null,
    gpaValue: profile.gpa_value,
    gpaScale: profile.gpa_scale,
    qualificationType: profile.qualification_type,
  };
}

/** Fetches every real, catalog program's nearest admission cycle's
 * requirements -- the candidate list the catalog-wide Eligibility Engine and
 * Unlock Simulator run against (task items 4/5). Mirrors
 * app/lib/data/match.ts:getRealMatchCandidates's "latest cycle per program"
 * convention. With today's real data volume (a handful of programs, most
 * with no admission cycle yet) this will usually return few or no
 * requirements per candidate -- callers must render that honestly ("Being
 * verified" / "not enough data"), never fabricate an eligibility. */
export async function getCatalogEligibilityCandidates(supabase: Client): Promise<CatalogProgramCandidate[]> {
  const [{ data: programs }, { data: universities }] = await Promise.all([
    supabase.from("programs").select("id, university_id, official_name"),
    supabase.from("universities").select("id, official_name"),
  ]);
  if (!programs || programs.length === 0) return [];

  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));
  const programIds = programs.map((p) => p.id);

  const { data: cycles } = await supabase
    .from("admission_cycles")
    .select("id, program_id, intake_year")
    .in("program_id", programIds);

  const cyclesByProgram = new Map<string, { id: string; program_id: string; intake_year: number }[]>();
  for (const cycle of cycles ?? []) {
    const list = cyclesByProgram.get(cycle.program_id) ?? [];
    list.push(cycle);
    cyclesByProgram.set(cycle.program_id, list);
  }

  const latestCycleByProgram = new Map<string, string>();
  for (const [programId, programCycles] of cyclesByProgram) {
    const latest = [...programCycles].sort((a, b) => b.intake_year - a.intake_year)[0];
    if (latest) latestCycleByProgram.set(programId, latest.id);
  }

  const cycleIds = Array.from(latestCycleByProgram.values());
  const { data: requirements } =
    cycleIds.length > 0
      ? await supabase.from("admission_requirements").select("*").in("admission_cycle_id", cycleIds)
      : { data: [] as Database["public"]["Tables"]["admission_requirements"]["Row"][] };

  const requirementsByCycle = new Map<string, Database["public"]["Tables"]["admission_requirements"]["Row"][]>();
  for (const req of requirements ?? []) {
    const list = requirementsByCycle.get(req.admission_cycle_id) ?? [];
    list.push(req);
    requirementsByCycle.set(req.admission_cycle_id, list);
  }

  const candidates: CatalogProgramCandidate[] = [];
  for (const program of programs) {
    const universityName = universityNameById.get(program.university_id);
    if (!universityName) continue;
    const cycleId = latestCycleByProgram.get(program.id);
    candidates.push({
      programId: program.id,
      universityId: program.university_id,
      universityName,
      programName: program.official_name,
      requirements: cycleId ? (requirementsByCycle.get(cycleId) ?? []) : [],
    });
  }
  return candidates;
}
