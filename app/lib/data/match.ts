import "server-only";

import { PRIORITY_TYPES } from "@/app/lib/profile-types";
import type { CountryCode } from "@/app/lib/countries";
import { createClient } from "@/app/lib/supabase/server";
import type { ApplicationType, Database, PriorityType } from "@/app/lib/supabase/database.types";
import type { MatchProfileInputs } from "@/app/lib/match/types";
import type { RealProgramCandidate } from "@/app/lib/match/real-types";
import { resolveBestOfficialUrl } from "@/app/lib/live-data/officialUrl";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface MatchProfileData {
  profileInputs: MatchProfileInputs;
  destinationCountries: CountryCode[];
  priorities: Record<PriorityType, number>;
}

export function profileToMatchInputs(profile: ProfileRow): MatchProfileInputs {
  const parsedEnglishScore = profile.english_test_score != null ? Number(profile.english_test_score) : NaN;
  return {
    fieldOfStudy: profile.field_of_study,
    applicationType: profile.application_type,
    maxTuition: profile.max_tuition,
    tuitionCurrency: profile.tuition_currency,
    maxLivingCost: profile.max_living_cost,
    livingCostCurrency: profile.living_cost_currency,
    englishTestType: profile.english_test_type,
    englishTestScore: Number.isFinite(parsedEnglishScore) ? parsedEnglishScore : null,
  };
}

/** Fetches everything the match engine needs from the user's existing
 * profile -- destination countries, field of study, degree type, budget,
 * and the 10 weighted priorities -- so the Match Quiz never has to ask for
 * it again. */
export async function getMatchProfileData(userId: string, profile: ProfileRow): Promise<MatchProfileData> {
  const supabase = await createClient();
  const [{ data: destinations }, { data: priorityRows }] = await Promise.all([
    supabase.from("profile_destination_preferences").select("country_code").eq("user_id", userId),
    supabase.from("profile_priorities").select("priority_type, weight").eq("user_id", userId),
  ]);

  const priorities = Object.fromEntries(
    PRIORITY_TYPES.map((type) => [type, 3]),
  ) as Record<PriorityType, number>;
  for (const row of priorityRows ?? []) {
    priorities[row.priority_type] = row.weight;
  }

  return {
    profileInputs: profileToMatchInputs(profile),
    destinationCountries: (destinations ?? []).map((d) => d.country_code as CountryCode),
    priorities,
  };
}

type SourceLite = {
  id: string;
  official_url: string | null;
  resolved_url: string | null;
  url_status: Database["public"]["Tables"]["sources"]["Row"]["url_status"];
  page_type: Database["public"]["Tables"]["sources"]["Row"]["page_type"];
  source_type: string;
  replaced_by_source_id: string | null;
  university_id: string | null;
  program_id: string | null;
  verified_at: string | null;
  last_checked_at: string | null;
};

/**
 * Every real program in `public.programs`, joined with its university and
 * (when one exists) its most recent admission cycle, for the real-data
 * Match Results engine (see app/lib/match/real-engine.ts). Never includes
 * anything from app/lib/match/demo-catalog.ts -- that fictional catalog
 * never touches Supabase at all. Small N-query approach (not a single
 * embedded select) since the catalog is intentionally small in v1 (see
 * AGENTS.md task notes: "do not bulk crawl yet").
 */
export async function getRealMatchCandidates(): Promise<RealProgramCandidate[]> {
  const supabase = await createClient();

  const [{ data: programs }, { data: universities }] = await Promise.all([
    supabase.from("programs").select("*"),
    supabase.from("universities").select("*"),
  ]);
  if (!programs || programs.length === 0) return [];

  const universityById = new Map((universities ?? []).map((u) => [u.id, u]));
  const programIds = programs.map((p) => p.id);
  const universityIds = Array.from(universityById.keys());

  const [{ data: cycles }, { data: sources }] = await Promise.all([
    programIds.length > 0
      ? supabase.from("admission_cycles").select("*").in("program_id", programIds)
      : Promise.resolve({ data: [] as Database["public"]["Tables"]["admission_cycles"]["Row"][] }),
    programIds.length > 0 || universityIds.length > 0
      ? supabase
          .from("sources")
          .select(
            "id, official_url, resolved_url, url_status, page_type, source_type, replaced_by_source_id, university_id, program_id, verified_at, last_checked_at",
          )
          .or(
            [
              programIds.length > 0 ? `program_id.in.(${programIds.join(",")})` : null,
              universityIds.length > 0 ? `university_id.in.(${universityIds.join(",")})` : null,
            ]
              .filter(Boolean)
              .join(","),
          )
      : Promise.resolve({ data: [] as SourceLite[] }),
  ]);

  const cyclesByProgram = new Map<string, Database["public"]["Tables"]["admission_cycles"]["Row"][]>();
  for (const cycle of cycles ?? []) {
    const list = cyclesByProgram.get(cycle.program_id) ?? [];
    list.push(cycle);
    cyclesByProgram.set(cycle.program_id, list);
  }

  const sourcesByProgram = new Map<string, SourceLite[]>();
  const sourcesByUniversity = new Map<string, SourceLite[]>();
  for (const source of (sources ?? []) as SourceLite[]) {
    if (source.program_id) {
      const list = sourcesByProgram.get(source.program_id) ?? [];
      list.push(source);
      sourcesByProgram.set(source.program_id, list);
    }
    if (source.university_id) {
      const list = sourcesByUniversity.get(source.university_id) ?? [];
      list.push(source);
      sourcesByUniversity.set(source.university_id, list);
    }
  }

  const candidates: RealProgramCandidate[] = [];
  for (const program of programs) {
    const university = universityById.get(program.university_id);
    if (!university) continue;

    const programCycles = (cyclesByProgram.get(program.id) ?? []).sort((a, b) => b.intake_year - a.intake_year);
    const cycle = programCycles[0] ?? null;

    const relevantSources = [
      ...(sourcesByProgram.get(program.id) ?? []),
      ...(sourcesByUniversity.get(program.university_id) ?? []),
    ];
    const lastCheckedAt = relevantSources.reduce<string | null>((latest, s) => {
      if (!s.last_checked_at) return latest;
      if (!latest || s.last_checked_at > latest) return s.last_checked_at;
      return latest;
    }, null);

    const bestOfficial = resolveBestOfficialUrl(
      relevantSources.map((s) => ({
        id: s.id,
        officialUrl: s.official_url,
        resolvedUrl: s.resolved_url,
        urlStatus: s.url_status,
        pageType: s.page_type,
        sourceType: s.source_type,
        replacedBySourceId: s.replaced_by_source_id,
      })),
      university.official_website,
    );

    candidates.push({
      programId: program.id,
      universityId: university.id,
      universityName: university.official_name,
      countryCode: (university.country_code as CountryCode | null) ?? null,
      city: university.city,
      officialWebsite: university.official_website,
      programName: program.official_name,
      degreeType: (program.degree_type as ApplicationType | null) ?? null,
      field: program.field,
      language: program.language,
      duration: program.duration,
      officialUrl: bestOfficial.url,
      officialUrlStatus: bestOfficial.status,
      tuitionAmount: cycle?.tuition ?? null,
      tuitionCurrency: cycle?.tuition_currency ?? null,
      applicationDeadline: cycle?.application_deadline ?? null,
      verified: bestOfficial.status === "verified",
      lastCheckedAt,
    });
  }

  return candidates;
}
