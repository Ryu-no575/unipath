import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { fanOutNotificationsForChangeEvent } from "./notify";

const DEMO_UNIVERSITY_NAME = "Politecnico di Milano";
const DEMO_PROGRAM_NAME = "BSc Architecture";
const DEMO_FIELD = "min_english_score";
const DEMO_VALUES = ["6.0", "6.5"] as const;

export interface SimulateChangeResult {
  changeEventId: string;
  entityName: string;
  oldValue: string | null;
  newValue: string;
}

/**
 * Development-only: exercises the real
 * detect -> snapshot -> change_event -> notify pipeline end to end, through
 * the exact same tables and fan-out path checkSource() uses (see
 * app/lib/live-data/checkSource.ts and notify.ts) -- nothing here is UI-only
 * or local state, so the result survives a refresh. Picks an entity the
 * calling user already watches when one exists; otherwise seeds the same
 * Politecnico di Milano / BSc Architecture demo program the product spec
 * example uses (and an application for it, so watch_subscriptions picks it
 * up), so this is runnable immediately after signup with no other setup.
 */
export async function simulateChangeForUser(userId: string): Promise<SimulateChangeResult> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("simulateChangeForUser is only available in development.");
  }

  const supabase = createAdminClient();

  const { data: subscription } = await supabase
    .from("watch_subscriptions")
    .select("program_id")
    .eq("user_id", userId)
    .eq("enabled", true)
    .not("program_id", "is", null)
    .limit(1)
    .maybeSingle();

  const programId = subscription?.program_id ?? (await ensureDemoWatch(supabase, userId));

  let { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("program_id", programId)
    .maybeSingle();
  if (!source) {
    const { data: program } = await supabase
      .from("programs")
      .select("official_name, official_url")
      .eq("id", programId)
      .maybeSingle();
    const { data: created, error } = await supabase
      .from("sources")
      .insert({
        source_type: "official_website",
        official_url: program?.official_url ?? "https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/architecture",
        publisher: DEMO_UNIVERSITY_NAME,
        page_type: "language_requirement",
        program_id: programId,
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) throw error ?? new Error("Failed to create a demo source.");
    source = created;
  }

  const { data: lastSnapshot } = await supabase
    .from("source_snapshots")
    .select("extracted_data")
    .eq("source_id", source.id)
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousExtracted = lastSnapshot?.extracted_data as Record<string, { value?: string }> | undefined;
  const previousValue = previousExtracted?.[DEMO_FIELD]?.value ?? DEMO_VALUES[0];
  const newValue = previousValue === DEMO_VALUES[0] ? DEMO_VALUES[1] : DEMO_VALUES[0];
  const now = new Date().toISOString();

  await supabase.from("source_snapshots").insert({
    source_id: source.id,
    content_hash: `simulated-${newValue}-${Date.now()}`,
    extracted_data: { [DEMO_FIELD]: { value: newValue, confidence: "high" } },
    retrieved_at: now,
  });

  const { data: changeEvent, error: changeEventError } = await supabase
    .from("change_events")
    .insert({
      source_id: source.id,
      entity_type: "program",
      entity_id: programId,
      field_name: DEMO_FIELD,
      old_value: previousValue,
      new_value: newValue,
      change_type: "value_changed",
      importance: "critical",
      review_status: "pending_review",
      is_simulated: true,
      detected_at: now,
    })
    .select("id")
    .single();
  if (changeEventError || !changeEvent) {
    throw changeEventError ?? new Error("Failed to insert change_event.");
  }

  await fanOutNotificationsForChangeEvent(changeEvent.id);

  const { data: program } = await supabase
    .from("programs")
    .select("official_name")
    .eq("id", programId)
    .maybeSingle();

  return {
    changeEventId: changeEvent.id,
    entityName: program?.official_name ?? DEMO_PROGRAM_NAME,
    oldValue: previousValue,
    newValue,
  };
}

/** Reuses (or creates) the Politecnico di Milano / BSc Architecture demo
 * program and adds a "considering" application for it, which the
 * applications_insert_watch_subscription trigger turns into a
 * watch_subscriptions row automatically -- so this never writes to
 * watch_subscriptions directly. */
async function ensureDemoWatch(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  let { data: university } = await supabase
    .from("universities")
    .select("id")
    .ilike("official_name", DEMO_UNIVERSITY_NAME)
    .maybeSingle();
  if (!university) {
    const { data, error } = await supabase
      .from("universities")
      .insert({
        official_name: DEMO_UNIVERSITY_NAME,
        country_code: "IT",
        city: "Milan",
        official_website: "https://www.polimi.it/en/",
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Failed to create a demo university.");
    university = data;
  }

  let { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("university_id", university.id)
    .ilike("official_name", DEMO_PROGRAM_NAME)
    .maybeSingle();
  if (!program) {
    const { data, error } = await supabase
      .from("programs")
      .insert({
        university_id: university.id,
        official_name: DEMO_PROGRAM_NAME,
        degree_type: "bachelor",
        field: "Architecture",
        language: "English",
        official_url: "https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/architecture",
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Failed to create a demo program.");
    program = data;
  }

  const { data: existingApplication } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", userId)
    .eq("program_id", program.id)
    .maybeSingle();
  if (!existingApplication) {
    const { error } = await supabase.from("applications").insert({
      user_id: userId,
      program_id: program.id,
      status: "considering",
    });
    if (error) throw error;
  }

  return program.id;
}
