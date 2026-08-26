"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { ApplicationStatus, IntakeSeason } from "@/app/lib/supabase/database.types";
import { CHECKLIST_TEMPLATE, type ChecklistTemplateItem } from "@/app/lib/checklist-template";

/**
 * Which university this application is for. `catalog` and `custom` reuse an
 * existing row (from UniPath's shared public.universities catalog, or from
 * this user's own private user_custom_universities table); `customNew`
 * creates a new private user_custom_universities row. The shared catalog
 * itself is never written to from here — see
 * supabase/migrations/20260826180000_canonical_university_model.sql.
 */
export type UniversitySelection =
  | { kind: "catalog"; universityId: string }
  | { kind: "custom"; customUniversityId: string }
  | { kind: "customNew"; name: string; countryCode: string; city: string; officialWebsite: string };

export interface CreateApplicationInput {
  university: UniversitySelection;
  programId: string | null;
  programName: string;
  degreeType: string;
  field: string;
  intakeYear: number;
  intakeSeason: IntakeSeason;
  /** Local datetime string from an <input type="datetime-local">, or "". */
  deadline: string;
  deadlineTimezone: string;
  suggestedTaskKeys: string[];
}

export interface ApplicationActionResult {
  error?: string;
}

function toNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function resolveUniversity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  selection: UniversitySelection,
): Promise<{ universityId: string | null; customUniversityId: string | null }> {
  if (selection.kind === "catalog") {
    return { universityId: selection.universityId, customUniversityId: null };
  }
  if (selection.kind === "custom") {
    return { universityId: null, customUniversityId: selection.customUniversityId };
  }

  // customNew: never insert into the shared public.universities catalog —
  // reuse this user's own previously-added custom entry with the same name
  // if there is one, otherwise create a new private row for them.
  const name = selection.name.trim();
  if (!name) throw new Error("University name is required.");

  const { data: existing } = await supabase
    .from("user_custom_universities")
    .select("id")
    .eq("user_id", userId)
    .ilike("university_name", name)
    .maybeSingle();
  if (existing) return { universityId: null, customUniversityId: existing.id };

  const { data, error } = await supabase
    .from("user_custom_universities")
    .insert({
      user_id: userId,
      university_name: name,
      country_code: toNull(selection.countryCode),
      city: toNull(selection.city),
      official_website: toNull(selection.officialWebsite),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { universityId: null, customUniversityId: data.id };
}

async function createApplicationRecord(
  locale: AppLocale,
  input: CreateApplicationInput,
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const programName = input.programName.trim();
  if (!programName) throw new Error("Program name is required.");

  // 1. University — reuse a catalog/custom row, or add a new private custom
  // one. public.universities (the shared canonical catalog) is never
  // inserted into here.
  const { universityId, customUniversityId } = await resolveUniversity(
    supabase,
    user.id,
    input.university,
  );

  const deadlineIso = input.deadline ? new Date(input.deadline).toISOString() : null;
  const deadlineTimezone = deadlineIso ? input.deadlineTimezone || "UTC" : null;

  let programId: string | null = null;
  let admissionCycleId: string | null = null;

  if (universityId) {
    // Official catalog path: reuse or add a program under the catalog
    // university, then reuse or add its admission cycle.
    programId = input.programId;
    if (!programId) {
      const { data, error } = await supabase
        .from("programs")
        .insert({
          university_id: universityId,
          official_name: programName,
          degree_type: toNull(input.degreeType),
          field: toNull(input.field),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      programId = data.id;
    }

    // Admission cycle — reuse an existing (program, year, season) cycle and
    // only fill in a still-missing deadline; never overwrite one that's
    // already set (also enforced in the DB by a trigger, see the migration).
    const { data: existingCycle } = await supabase
      .from("admission_cycles")
      .select("*")
      .eq("program_id", programId)
      .eq("intake_year", input.intakeYear)
      .eq("intake_season", input.intakeSeason)
      .maybeSingle();

    if (existingCycle) {
      admissionCycleId = existingCycle.id;
      if (!existingCycle.application_deadline && deadlineIso) {
        const { error } = await supabase
          .from("admission_cycles")
          .update({
            application_deadline: deadlineIso,
            deadline_timezone: deadlineTimezone,
          })
          .eq("id", existingCycle.id);
        if (error) throw new Error(error.message);
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("admission_cycles")
        .insert({
          program_id: programId,
          intake_year: input.intakeYear,
          intake_season: input.intakeSeason,
          application_deadline: deadlineIso,
          deadline_timezone: deadlineTimezone,
        })
        .select("id")
        .single();

      if (error) {
        // Unique-violation race: someone else created the same cycle a
        // moment ago. Fall back to it instead of failing the whole
        // application.
        if (error.code === "23505") {
          const { data: raceWinner, error: refetchError } = await supabase
            .from("admission_cycles")
            .select("id")
            .eq("program_id", programId)
            .eq("intake_year", input.intakeYear)
            .eq("intake_season", input.intakeSeason)
            .maybeSingle();
          if (!raceWinner) throw new Error(refetchError?.message ?? error.message);
          admissionCycleId = raceWinner.id;
        } else {
          throw new Error(error.message);
        }
      } else {
        admissionCycleId = inserted.id;
      }
    }
  }

  // 2. The application itself.
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      program_id: programId,
      admission_cycle_id: admissionCycleId,
      custom_university_id: customUniversityId,
      custom_program_name: customUniversityId ? programName : null,
      custom_degree_type: customUniversityId ? toNull(input.degreeType) : null,
      custom_field: customUniversityId ? toNull(input.field) : null,
      custom_intake_year: customUniversityId ? input.intakeYear : null,
      custom_intake_season: customUniversityId ? input.intakeSeason : null,
      custom_application_deadline: customUniversityId ? deadlineIso : null,
      custom_deadline_timezone: customUniversityId ? deadlineTimezone : null,
      status: "considering",
    })
    .select("id")
    .single();
  if (applicationError) throw new Error(applicationError.message);

  // 3. Suggested checklist tasks the user kept checked. Titles are resolved
  // to real text in the user's current locale now, at creation time — a
  // task's title is free-text the user can edit afterward, not a live
  // i18n key.
  if (input.suggestedTaskKeys.length > 0) {
    const [{ data: profile }, checklistT] = await Promise.all([
      supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
      getTranslations({ locale, namespace: "ChecklistTemplate" }),
    ]);
    const timezone = profile?.timezone || "UTC";
    const templateByKey = new Map<string, ChecklistTemplateItem>(
      CHECKLIST_TEMPLATE.map((item) => [item.key, item]),
    );

    const rows = input.suggestedTaskKeys
      .map((key) => templateByKey.get(key))
      .filter((item): item is ChecklistTemplateItem => Boolean(item))
      .map((item) => ({
        user_id: user.id,
        application_id: application.id,
        title: checklistT(item.key),
        task_type: item.taskType,
        timezone,
        completed: false,
        priority: 2,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("tasks").insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  return application.id;
}

export async function createApplicationAction(
  locale: AppLocale,
  input: CreateApplicationInput,
): Promise<ApplicationActionResult> {
  let applicationId: string;
  try {
    applicationId = await createApplicationRecord(locale, input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create the application.",
    };
  }

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/applications`);
  revalidatePath(`/${locale}/calendar`);
  redirect(`/${locale}/applications/${applicationId}`);
}

export async function updateApplicationStatusAction(
  locale: AppLocale,
  applicationId: string,
  status: ApplicationStatus,
): Promise<ApplicationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/applications/${applicationId}`);
  revalidatePath(`/${locale}/applications`);
  revalidatePath(`/${locale}/dashboard`);
  return {};
}
