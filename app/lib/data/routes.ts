import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import {
  getAdmissionRequirementsForCycle,
  getApplicationDocuments,
  getDocumentLinksForUser,
  getReadinessForApplications,
  getTestScores,
} from "@/app/lib/data/passport";
import { getUniversityForCommunity } from "@/app/lib/data/community";
import { getMatchProfileData, getRealMatchCandidates } from "@/app/lib/data/match";
import { computeRealMatches } from "@/app/lib/match/real-engine";
import type { RealMatchResult } from "@/app/lib/match/real-types";
import type { RouteApplication, RouteEngineInput, RouteTarget } from "@/app/lib/routes/types";

type Client = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AdmissionCycleRow = Database["public"]["Tables"]["admission_cycles"]["Row"];

interface GetRouteEngineInputOptions {
  targetUniversityId?: string | null;
  targetProgramId?: string | null;
  /** ISO date, injectable for tests; defaults to now. */
  today?: string;
}

async function fetchTuitionByCycleId(
  supabase: Client,
  cycleIds: string[],
): Promise<Map<string, { tuitionAmount: number | null; tuitionCurrency: string | null }>> {
  const map = new Map<string, { tuitionAmount: number | null; tuitionCurrency: string | null }>();
  if (cycleIds.length === 0) return map;
  const { data } = await supabase.from("admission_cycles").select("*").in("id", cycleIds);
  for (const cycle of (data ?? []) as AdmissionCycleRow[]) {
    map.set(cycle.id, { tuitionAmount: cycle.tuition, tuitionCurrency: cycle.tuition_currency });
  }
  return map;
}

async function buildTarget(
  supabase: Client,
  options: { universityId: string; programId?: string | null },
  matchResults: RealMatchResult[],
): Promise<RouteTarget | null> {
  const university = await getUniversityForCommunity(supabase, options.universityId);
  if (!university) return null;

  let programId = options.programId ?? null;
  if (!programId) {
    const { data: firstProgram } = await supabase
      .from("programs")
      .select("id")
      .eq("university_id", options.universityId)
      .order("official_name")
      .limit(1)
      .maybeSingle();
    programId = firstProgram?.id ?? null;
  }

  let admissionCycle: RouteTarget["admissionCycle"] = null;
  let requirements: RouteTarget["requirements"] = [];
  let tuitionAmount: number | null = null;
  let tuitionCurrency: string | null = null;

  if (programId) {
    const { data: cycles } = await supabase
      .from("admission_cycles")
      .select("*")
      .eq("program_id", programId)
      .order("intake_year", { ascending: false });
    const latest = (cycles ?? [])[0] as AdmissionCycleRow | undefined;
    if (latest) {
      admissionCycle = {
        id: latest.id,
        intakeYear: latest.intake_year,
        intakeSeason: latest.intake_season,
        applicationDeadline: latest.application_deadline,
        deadlineTimezone: latest.deadline_timezone,
      };
      tuitionAmount = latest.tuition;
      tuitionCurrency = latest.tuition_currency;
      requirements = await getAdmissionRequirementsForCycle(supabase, latest.id);
    }
  }

  const matchScorePercent = programId
    ? (matchResults.find((r) => r.candidate.programId === programId)?.scorePercent ?? null)
    : null;

  return {
    universityId: university.id,
    universityName: university.name,
    programId,
    admissionCycle,
    requirements,
    tuitionAmount,
    tuitionCurrency,
    matchScorePercent,
  };
}

/** Assembles everything app/lib/routes/generateRoute.ts needs, entirely from
 * real Supabase rows -- applications, their admission_requirements and
 * tuition, tasks, test scores, documents, match_preferences, and (optionally)
 * one prospective target university/program the user hasn't applied to yet.
 * Nothing here is persisted -- Routes are recomputed on every request (task
 * brief item 16/17). */
export async function getRouteEngineInput(
  supabase: Client,
  userId: string,
  profile: ProfileRow,
  options: GetRouteEngineInputOptions = {},
): Promise<RouteEngineInput> {
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const [applications, documents, testScores, documentLinks, { data: tasks }, { data: matchPreferences }] =
    await Promise.all([
      getApplicationsWithDetails(supabase, userId),
      getApplicationDocuments(supabase, userId),
      getTestScores(supabase, userId),
      getDocumentLinksForUser(supabase),
      supabase.from("tasks").select("*").eq("user_id", userId),
      supabase.from("match_preferences").select("scholarship_need").eq("user_id", userId).maybeSingle(),
    ]);

  const linkedDocumentIds = new Set(
    documentLinks.filter((l) => applications.some((a) => a.id === l.applicationId)).map((l) => l.documentId),
  );

  const readinessList = await getReadinessForApplications(supabase, {
    applications,
    documents,
    testScores,
    links: documentLinks,
    profile: { english_test_type: profile.english_test_type, english_test_score: profile.english_test_score },
  });
  const readinessByApplicationId = new Map(readinessList.map((r) => [r.applicationId, r]));

  const cycleIds = Array.from(
    new Set(applications.map((a) => a.admissionCycle?.id).filter((id): id is string => Boolean(id))),
  );
  const [tuitionByCycleId, requirementsByApplication] = await Promise.all([
    fetchTuitionByCycleId(supabase, cycleIds),
    Promise.all(
      applications.map(async (application) => ({
        applicationId: application.id,
        requirements: application.admissionCycle
          ? await getAdmissionRequirementsForCycle(supabase, application.admissionCycle.id)
          : [],
      })),
    ),
  ]);
  const requirementsByApplicationId = new Map(
    requirementsByApplication.map((r) => [r.applicationId, r.requirements]),
  );

  const routeApplications: RouteApplication[] = applications.map((application) => {
    const tuition = application.admissionCycle ? tuitionByCycleId.get(application.admissionCycle.id) : undefined;
    return {
      application,
      requirements: requirementsByApplicationId.get(application.id) ?? [],
      readiness: readinessByApplicationId.get(application.id)!,
      tuitionAmount: tuition?.tuitionAmount ?? null,
      tuitionCurrency: tuition?.tuitionCurrency ?? null,
    };
  });

  const { profileInputs, destinationCountries } = await getMatchProfileData(userId, profile);
  const candidates = await getRealMatchCandidates();
  const matchResults = computeRealMatches({ profile: profileInputs, destinationCountries, candidates }).results;

  const target =
    options.targetUniversityId != null
      ? await buildTarget(
          supabase,
          { universityId: options.targetUniversityId, programId: options.targetProgramId },
          matchResults,
        )
      : null;

  return {
    today,
    profile,
    scholarshipNeed: matchPreferences?.scholarship_need ?? false,
    applications: routeApplications,
    tasks: tasks ?? [],
    testScores,
    documents,
    linkedDocumentIds,
    matchResults,
    target,
  };
}
