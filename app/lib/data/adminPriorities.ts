import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { isVerifiedStatus } from "@/app/lib/live-data/sourceStatus";
import { classifyInstitutionNamePattern } from "@/app/lib/importers/ror";
import {
  computeInternalDemandRawScore,
  computeUniversityPriority,
  selectPriorityWeights,
  type PriorityTier,
  type PriorityWeights,
  type UniversityPriorityInput,
  type UniversityPriorityResult,
} from "@/app/lib/priority/score";

type Client = SupabaseClient<Database>;

/**
 * Demand Priority Engine data loader for /admin/priorities (task: University
 * Data Strategy pivot, sections 9/10). Loads every real signal the engine
 * needs and scores all 357(ish) universities in memory -- same bounded-size
 * reasoning as listAdminUniversities in ./adminUniversities.
 *
 * Internal-demand signals today are real but sparse (task brief section 8's
 * "feedback loop" is architecturally wired in via selectPriorityWeights, but
 * UniPath has no search/save/match-impression event log yet -- Explore's
 * "saved"/"compare" lists are deliberately client-only localStorage, see
 * app/lib/explore/savedUniversities.ts, and match quiz answers travel via URL
 * params, never a DB write, see app/lib/match/query.ts). What *is* real and
 * queryable: `applications` rows resolved to a catalog program, `watch_subscriptions`
 * (the closest existing proxy for "data request" interest), and
 * `community_posts`. Search-count and match-appearance-count stay at 0 until
 * a real event log exists -- never estimated or faked.
 */
export interface PriorityEngineResult {
  regime: "early_stage" | "mature";
  weights: PriorityWeights;
  totalInternalDemandEvents: number;
  universities: UniversityPriorityResult[];
  tierCounts: Record<PriorityTier, number>;
}

export async function getUniversityPriorities(supabase: Client): Promise<PriorityEngineResult> {
  const [
    { data: universities },
    { data: programs },
    { data: cycles },
    { data: sources },
    { data: applications },
    { data: communityPosts },
    { data: watchSubscriptions },
  ] = await Promise.all([
    supabase.from("universities").select("id, official_name, country_code, official_website, ror_id"),
    supabase.from("programs").select("id, university_id, field, language, degree_type, verified_at"),
    supabase.from("admission_cycles").select("id, program_id"),
    supabase
      .from("sources")
      .select("university_id, program_id, url_status, admin_rejected")
      .neq("source_type", "ror"),
    supabase.from("applications").select("id, program_id").not("program_id", "is", null),
    supabase.from("community_posts").select("id, university_id"),
    supabase.from("watch_subscriptions").select("id, university_id, program_id").eq("enabled", true),
  ]);

  if (!universities || universities.length === 0) {
    const { weights, regime } = selectPriorityWeights(0);
    return { regime, weights, totalInternalDemandEvents: 0, universities: [], tierCounts: emptyTierCounts() };
  }

  const universityIdByProgramId = new Map((programs ?? []).map((p) => [p.id, p.university_id]));

  const programIdsWithCycle = new Set((cycles ?? []).map((c) => c.program_id));

  const programsByUniversity = new Map<string, typeof programs>();
  for (const p of programs ?? []) {
    const bucket = programsByUniversity.get(p.university_id) ?? [];
    bucket.push(p);
    programsByUniversity.set(p.university_id, bucket);
  }

  const healthySourceUniversityIds = new Set<string>();
  const anySourceUniversityIds = new Set<string>();
  for (const s of sources ?? []) {
    const universityId = s.university_id ?? (s.program_id ? universityIdByProgramId.get(s.program_id) : null);
    if (!universityId) continue;
    anySourceUniversityIds.add(universityId);
    if (!s.admin_rejected && isVerifiedStatus(s.url_status)) healthySourceUniversityIds.add(universityId);
  }

  const applicationCountByUniversity = new Map<string, number>();
  for (const a of applications ?? []) {
    const universityId = a.program_id ? universityIdByProgramId.get(a.program_id) : null;
    if (!universityId) continue;
    applicationCountByUniversity.set(universityId, (applicationCountByUniversity.get(universityId) ?? 0) + 1);
  }

  const communityPostCountByUniversity = new Map<string, number>();
  for (const c of communityPosts ?? []) {
    communityPostCountByUniversity.set(c.university_id, (communityPostCountByUniversity.get(c.university_id) ?? 0) + 1);
  }

  const watchCountByUniversity = new Map<string, number>();
  for (const w of watchSubscriptions ?? []) {
    const universityId = w.university_id ?? (w.program_id ? universityIdByProgramId.get(w.program_id) : null);
    if (!universityId) continue;
    watchCountByUniversity.set(universityId, (watchCountByUniversity.get(universityId) ?? 0) + 1);
  }

  const inputs: UniversityPriorityInput[] = universities.map((u) => {
    const universityPrograms = programsByUniversity.get(u.id) ?? [];
    return {
      id: u.id,
      name: u.official_name,
      countryCode: u.country_code,
      namePattern: classifyInstitutionNamePattern(u.official_name),
      demand: {
        applicationCount: applicationCountByUniversity.get(u.id) ?? 0,
        communityPostCount: communityPostCountByUniversity.get(u.id) ?? 0,
        watchSubscriptionCount: watchCountByUniversity.get(u.id) ?? 0,
      },
      programs: universityPrograms.map((p) => ({
        field: p.field,
        language: p.language,
        degreeType: p.degree_type,
        verifiedAt: p.verified_at,
        hasAdmissionCycle: programIdsWithCycle.has(p.id),
      })),
      dataQuality: {
        hasStableIdentifier: Boolean(u.ror_id),
        hasOfficialWebsite: Boolean(u.official_website) || anySourceUniversityIds.has(u.id),
        hasHealthySource: healthySourceUniversityIds.has(u.id),
      },
    };
  });

  const totalInternalDemandEvents = inputs.reduce((sum, i) => sum + computeInternalDemandRawScore(i.demand), 0);
  const maxRawInternalDemand = Math.max(0, ...inputs.map((i) => computeInternalDemandRawScore(i.demand)));
  const { weights, regime } = selectPriorityWeights(totalInternalDemandEvents);

  const results = inputs
    .map((input) => computeUniversityPriority(input, weights, maxRawInternalDemand))
    .sort((a, b) => b.score - a.score);

  const tierCounts = emptyTierCounts();
  for (const r of results) tierCounts[r.tier] += 1;

  return { regime, weights, totalInternalDemandEvents, universities: results, tierCounts };
}

function emptyTierCounts(): Record<PriorityTier, number> {
  return { tier_1_core: 0, tier_2_important: 0, tier_3_long_tail: 0 };
}
