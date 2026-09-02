import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { bestSourceInfo, getApplicationsWithDetails } from "@/app/lib/data/applications";
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
import type { ApplicationWithDetails } from "@/app/lib/data/applications";
import type { RouteApplication, RouteEngineInput, RouteTarget, VisaTimingInput } from "@/app/lib/routes/types";

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
      const [{ data: cycleSources }, cycleRequirements] = await Promise.all([
        supabase.from("sources").select("*").eq("admission_cycle_id", latest.id).eq("admin_rejected", false),
        getAdmissionRequirementsForCycle(supabase, latest.id),
      ]);
      admissionCycle = {
        id: latest.id,
        intakeYear: latest.intake_year,
        intakeSeason: latest.intake_season,
        applicationDeadline: latest.application_deadline,
        deadlineTimezone: latest.deadline_timezone,
        programStartDate: latest.program_start_date,
        orientationDate: latest.orientation_date,
        housingDeadline: latest.housing_deadline,
        housingMoveInDate: latest.housing_move_in_date,
        applicationDeadlineSource: bestSourceInfo(cycleSources ?? undefined),
      };
      tuitionAmount = latest.tuition;
      tuitionCurrency = latest.tuition_currency;
      requirements = cycleRequirements;
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
    destinationCountryCode: university.countryCode,
  };
}

/** Which of the user's real applications (or the previewed target) the Visa
 * Date Engine anchors on -- the accepted offer once one exists, else
 * whichever application is driving the earliest known application deadline
 * (a reasonable preview target), matching the same precedence
 * app/lib/routes/context.ts uses for its own LogisticsAnchor. Kept in sync
 * deliberately: both resolve "the one real destination this user's Route is
 * currently about" the same way. */
function resolvePrimaryDestinationCountryCode(
  applications: ApplicationWithDetails[],
  target: RouteTarget | null,
): string | null {
  if (target) return target.destinationCountryCode;
  const accepted = applications.find((a) => a.status === "accepted" && a.university?.countryCode);
  if (accepted) return accepted.university!.countryCode;
  const withDeadline = applications
    .filter((a) => a.admissionCycle?.applicationDeadline && a.university?.countryCode)
    .sort((a, b) => a.admissionCycle!.applicationDeadline!.localeCompare(b.admissionCycle!.applicationDeadline!));
  if (withDeadline.length > 0) return withDeadline[0].university!.countryCode;
  return applications.find((a) => a.university?.countryCode)?.university?.countryCode ?? null;
}

/** Resolves this user's real, admin-verified Visa timing data (task brief
 * PART B item 6/7) -- by (nationality, destination, study level), the exact
 * same match key startVisaJourneyAction already uses (app/lib/actions/visa.ts)
 * for the separate Visa Journey feature. Null when no matching
 * visa_requirement_profiles row exists yet, or the user hasn't set
 * nationality/study level -- visaDates.ts then renders "Being verified",
 * never a fabricated number. */
async function getVisaTimingInput(
  supabase: Client,
  profile: ProfileRow,
  destinationCountryCode: string | null,
): Promise<VisaTimingInput | null> {
  if (!profile.nationality || !profile.application_type || !destinationCountryCode) return null;

  const { data: visaProfile } = await supabase
    .from("visa_requirement_profiles")
    .select("*")
    .eq("nationality_country", profile.nationality)
    .eq("destination_country", destinationCountryCode)
    .eq("study_level", profile.application_type)
    .maybeSingle();
  if (!visaProfile) return null;

  const [{ data: sourceRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from("sources")
      .select("*")
      .eq("visa_profile_id", visaProfile.id)
      .eq("admin_rejected", false)
      .limit(1),
    supabase
      .from("visa_requirement_items")
      .select("*")
      .eq("visa_profile_id", visaProfile.id)
      .not("deadline_days_after_arrival", "is", null),
  ]);

  const sourceRow = (sourceRows ?? [])[0] ?? null;
  return {
    profile: visaProfile,
    source: sourceRow
      ? {
          label: sourceRow.publisher ?? sourceRow.title ?? destinationCountryCode,
          url: sourceRow.resolved_url ?? sourceRow.official_url,
          lastCheckedAt: sourceRow.last_checked_at,
        }
      : null,
    postArrivalItems: itemRows ?? [],
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

  const destinationCountryCode = resolvePrimaryDestinationCountryCode(applications, target);
  const visaTiming = await getVisaTimingInput(supabase, profile, destinationCountryCode);

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
    visaTiming,
  };
}
