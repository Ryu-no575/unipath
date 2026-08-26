import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationStatus,
  Database,
  IntakeSeason,
} from "@/app/lib/supabase/database.types";

export interface UniversitySummary {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  officialWebsite: string | null;
}

export interface ProgramSummary {
  id: string;
  universityId: string;
  name: string;
  degreeType: string | null;
  field: string | null;
}

export interface AdmissionCycleSummary {
  id: string;
  intakeYear: number;
  intakeSeason: IntakeSeason;
  applicationDeadline: string | null;
  deadlineTimezone: string | null;
}

export interface ApplicationWithDetails {
  id: string;
  status: ApplicationStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  university: UniversitySummary | null;
  program: ProgramSummary | null;
  admissionCycle: AdmissionCycleSummary | null;
  /** true when `university`/`program` come from this user's private
   * user_custom_universities entry rather than the shared catalog -- there
   * is no official `sources` row to link for those (see
   * app/lib/data/sources.ts). */
  isCustomUniversity: boolean;
}

type Client = SupabaseClient<Database>;
type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type AdmissionCycleRow = Database["public"]["Tables"]["admission_cycles"]["Row"];
type UniversityRow = Database["public"]["Tables"]["universities"]["Row"];
type CustomUniversityRow = Database["public"]["Tables"]["user_custom_universities"]["Row"];

/** All applications for a user, joined with program/university/admission
 * cycle info via separate in-memory joins (the typed client's Relationships
 * are intentionally empty — see database.types.ts's own doc comment — so
 * embedded `.select("*, programs(*)")` calls aren't type-safe here). */
export async function getApplicationsWithDetails(
  supabase: Client,
  userId: string,
): Promise<ApplicationWithDetails[]> {
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return joinApplicationDetails(supabase, applications ?? []);
}

export async function getApplicationWithDetails(
  supabase: Client,
  userId: string,
  applicationId: string,
): Promise<ApplicationWithDetails | null> {
  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) return null;
  const [joined] = await joinApplicationDetails(supabase, [application]);
  return joined ?? null;
}

async function joinApplicationDetails(
  supabase: Client,
  applications: ApplicationRow[],
): Promise<ApplicationWithDetails[]> {
  if (applications.length === 0) return [];

  const programIds = Array.from(
    new Set(applications.map((a) => a.program_id).filter((id): id is string => Boolean(id))),
  );
  const cycleIds = Array.from(
    new Set(
      applications
        .map((a) => a.admission_cycle_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const customUniversityIds = Array.from(
    new Set(
      applications
        .map((a) => a.custom_university_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [programsResult, cyclesResult, customUniversitiesResult] = await Promise.all([
    programIds.length > 0
      ? supabase.from("programs").select("*").in("id", programIds)
      : Promise.resolve({ data: [] as ProgramRow[] }),
    cycleIds.length > 0
      ? supabase.from("admission_cycles").select("*").in("id", cycleIds)
      : Promise.resolve({ data: [] as AdmissionCycleRow[] }),
    customUniversityIds.length > 0
      ? supabase.from("user_custom_universities").select("*").in("id", customUniversityIds)
      : Promise.resolve({ data: [] as CustomUniversityRow[] }),
  ]);
  const programs = programsResult.data ?? [];
  const cycles = cyclesResult.data ?? [];
  const customUniversities = customUniversitiesResult.data ?? [];

  const universityIds = Array.from(new Set(programs.map((p) => p.university_id)));
  const { data: universities } =
    universityIds.length > 0
      ? await supabase.from("universities").select("*").in("id", universityIds)
      : { data: [] as UniversityRow[] };

  const universityById = new Map((universities ?? []).map((u) => [u.id, u]));
  const programById = new Map(programs.map((p) => [p.id, p]));
  const cycleById = new Map(cycles.map((c) => [c.id, c]));
  const customUniversityById = new Map(customUniversities.map((u) => [u.id, u]));

  return applications.map((application) => {
    // Custom-university path: everything comes from user_custom_universities
    // plus the custom_* columns on the application itself — no program_id /
    // admission_cycle_id rows exist for these.
    if (application.custom_university_id) {
      const customUniversity = customUniversityById.get(application.custom_university_id) ?? null;

      return {
        id: application.id,
        status: application.status,
        progress: application.progress,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
        university: customUniversity
          ? {
              id: customUniversity.id,
              name: customUniversity.university_name,
              countryCode: customUniversity.country_code,
              city: customUniversity.city,
              officialWebsite: customUniversity.official_website,
            }
          : null,
        program: application.custom_program_name
          ? {
              id: application.id,
              universityId: application.custom_university_id,
              name: application.custom_program_name,
              degreeType: application.custom_degree_type,
              field: application.custom_field,
            }
          : null,
        admissionCycle:
          application.custom_intake_year && application.custom_intake_season
            ? {
                id: application.id,
                intakeYear: application.custom_intake_year,
                intakeSeason: application.custom_intake_season,
                applicationDeadline: application.custom_application_deadline,
                deadlineTimezone: application.custom_deadline_timezone,
              }
            : null,
        isCustomUniversity: true,
      };
    }

    const program = application.program_id ? (programById.get(application.program_id) ?? null) : null;
    const university = program
      ? (universityById.get(program.university_id) ?? null)
      : null;
    const cycle = application.admission_cycle_id
      ? (cycleById.get(application.admission_cycle_id) ?? null)
      : null;

    return {
      id: application.id,
      status: application.status,
      progress: application.progress,
      createdAt: application.created_at,
      updatedAt: application.updated_at,
      university: university
        ? {
            id: university.id,
            name: university.official_name,
            countryCode: university.country_code,
            city: university.city,
            officialWebsite: university.official_website,
          }
        : null,
      program: program
        ? {
            id: program.id,
            universityId: program.university_id,
            name: program.official_name,
            degreeType: program.degree_type,
            field: program.field,
          }
        : null,
      admissionCycle: cycle
        ? {
            id: cycle.id,
            intakeYear: cycle.intake_year,
            intakeSeason: cycle.intake_season,
            applicationDeadline: cycle.application_deadline,
            deadlineTimezone: cycle.deadline_timezone,
          }
        : null,
      isCustomUniversity: false,
    };
  });
}

export function applicationDisplayName(
  app: Pick<ApplicationWithDetails, "university" | "program">,
  fallback: string,
): string {
  return app.university?.name ?? fallback;
}
