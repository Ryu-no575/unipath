// Demand Priority Engine -- real-data report CLI (task: University Data
// Strategy pivot, section 10: "現在の357大学を実際に分析してください... TOP 50
// verification priorities を内部的に生成してください"). Prints the exact same
// scores app/lib/data/adminPriorities.ts computes -- it re-queries the same
// tables directly with a service-role client instead of importing that file,
// since it imports "server-only" (Next-build-only; see scripts/data-status.ts's
// note on the same constraint). Scoring logic itself (app/lib/priority/score.ts,
// app/lib/priority/weights.ts) has no such restriction and is imported directly,
// so there is exactly one implementation of the actual math.
//
// Usage:
//   npm run priority:report
//   npm run priority:report -- --top=50

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../app/lib/supabase/database.types.ts";
import { isVerifiedStatus } from "../app/lib/live-data/sourceStatus.ts";
import { classifyInstitutionNamePattern } from "../app/lib/importers/ror/index.ts";
import {
  computeInternalDemandRawScore,
  computeUniversityPriority,
  selectPriorityWeights,
  type UniversityPriorityInput,
} from "../app/lib/priority/score.ts";

function parseArgs(argv: string[]) {
  let top = 50;
  for (const arg of argv) {
    if (arg.startsWith("--top=")) {
      const value = Number(arg.slice("--top=".length));
      if (Number.isFinite(value) && value > 0) top = value;
    }
  }
  return { top };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
    process.exit(1);
  }
  const supabase = createClient<Database>(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { top } = parseArgs(process.argv.slice(2));

  const [
    { data: universities },
    { data: programs },
    { data: cycles },
    { data: sources },
    { data: applications },
    { data: communityPosts },
    { data: watchSubscriptions },
    { count: verifiedProgramCount },
    { count: verifiedAdmissionsCount },
    { count: healthySourceCount },
  ] = await Promise.all([
    supabase.from("universities").select("id, official_name, country_code, official_website, ror_id"),
    supabase.from("programs").select("id, university_id, field, language, degree_type, verified_at"),
    supabase.from("admission_cycles").select("id, program_id").not("application_deadline", "is", null),
    supabase.from("sources").select("university_id, program_id, url_status, admin_rejected").neq("source_type", "ror"),
    supabase.from("applications").select("id, program_id").not("program_id", "is", null),
    supabase.from("community_posts").select("id, university_id"),
    supabase.from("watch_subscriptions").select("id, university_id, program_id").eq("enabled", true),
    supabase.from("programs").select("*", { count: "exact", head: true }).not("verified_at", "is", null),
    supabase.from("admission_cycles").select("*", { count: "exact", head: true }).not("application_deadline", "is", null),
    supabase.from("sources").select("*", { count: "exact", head: true }).neq("source_type", "ror").eq("url_status", "valid"),
  ]);

  if (!universities || universities.length === 0) {
    console.log("No universities found.");
    return;
  }

  const universityIdByProgramId = new Map((programs ?? []).map((p) => [p.id, p.university_id]));
  const programIdsWithCycle = new Set((cycles ?? []).map((c) => c.program_id));

  const programsByUniversity = new Map<string, NonNullable<typeof programs>>();
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

  const tierCounts = { tier_1_core: 0, tier_2_important: 0, tier_3_long_tail: 0 };
  for (const r of results) tierCounts[r.tier]++;

  const namePatternCounts = { qualifies: 0, disqualifies: 0, ambiguous: 0 };
  for (const i of inputs) namePatternCounts[i.namePattern]++;

  console.log("DEMAND PRIORITY ENGINE -- CURRENT DATASET");
  console.log("");
  console.log(`Weight regime: ${regime} (total internal demand events: ${totalInternalDemandEvents})`);
  console.log(`Weights: ${JSON.stringify(weights)}`);
  console.log("");
  console.log(`Total Universities:       ${universities.length}`);
  console.log(`Tier 1 Core:              ${tierCounts.tier_1_core}`);
  console.log(`Tier 2 Important:         ${tierCounts.tier_2_important}`);
  console.log(`Tier 3 Long Tail:         ${tierCounts.tier_3_long_tail}`);
  console.log("");
  console.log(`Verified Programs:        ${verifiedProgramCount ?? 0} (of ${programs?.length ?? 0} total)`);
  console.log(`Verified Admissions:      ${verifiedAdmissionsCount ?? 0}`);
  console.log(`Healthy Official Sources: ${healthySourceCount ?? 0} (of ${(sources ?? []).length} total non-ROR sources)`);
  console.log("");
  console.log(`Name-pattern check: qualifies=${namePatternCounts.qualifies} ambiguous=${namePatternCounts.ambiguous} disqualifies=${namePatternCounts.disqualifies}`);
  console.log("");

  const scores = results.map((r) => r.score);
  console.log(`Score distribution: min=${Math.min(...scores)} p25=${percentile(scores, 25)} median=${percentile(scores, 50)} p75=${percentile(scores, 75)} max=${Math.max(...scores)}`);
  console.log("");

  console.log(`TOP ${top} VERIFICATION PRIORITIES`);
  console.log("");
  results.slice(0, top).forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}. [${r.score.toString().padStart(3)}] ${r.tier.padEnd(18)} ${r.name} (${r.countryCode ?? "?"})`);
    console.log(`      Why: ${r.reasons.join(" | ")}`);
    console.log(`      Missing: ${r.missingData.join(" | ") || "none"}`);
    console.log(`      Next: ${r.nextAction}`);
  });
}

function percentile(sortedDesc: number[], p: number): number {
  const sorted = [...sortedDesc].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
