// Registers real official sources for the Verified Live Data System Proof of
// Concept -- NOT a seed of fake change history (see
// scripts/seed-live-data-demo.mjs for that). This script writes only catalog
// metadata (a university, a program, an admission cycle + requirements, and
// `sources` rows pointing at real, public official pages) and never touches
// source_snapshots, change_events, or notifications -- those must only ever
// be written by a real checkSource() run (app/lib/live-data/checkSource.ts),
// triggered from the "Check source now" button on an application's detail
// page.
//
// Every URL and fact below was verified live against polimi.it while
// building Real University Data v1 -- including discovering that the
// previous version of this script pointed at a URL that had since gone
// 404 (/en/education/how-to-enrol), which is exactly the kind of drift this
// system exists to catch. Facts not stated on the page (application fee,
// standardized English test score) are left null, not guessed.
//
// Usage (after setting SUPABASE_SERVICE_ROLE_KEY in .env.local):
//   node --env-file=.env.local scripts/register-poc-source.mjs
// or:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/register-poc-source.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (see .env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UNIVERSITY_NAME = "Politecnico di Milano";
const UNIVERSITY_WEBSITE = "https://www.polimi.it/en/";
const PROGRAM_NAME = "BSc Architecture";

// Live, public official pages (verified 2026-08-26). The admissions hub page
// links to both -- see https://www.polimi.it/en/prospective-students/how-to-apply.
const ADMISSIONS_HUB_URL = "https://www.polimi.it/en/prospective-students/how-to-apply";
const ARCHITECTURE_ADMISSION_URL =
  "https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/architecture";
const TUITION_PAGE_URL =
  "https://www.polimi.it/en/prospective-students/how-much-does-it-cost/laurea-laurea-magistrale-and-single-cycle-programmes";

async function upsertUniversity() {
  let { data: university } = await supabase
    .from("universities")
    .select("id")
    .ilike("official_name", UNIVERSITY_NAME)
    .maybeSingle();
  if (!university) {
    const { data, error } = await supabase
      .from("universities")
      .insert({
        official_name: UNIVERSITY_NAME,
        country_code: "IT",
        city: "Milan",
        official_website: UNIVERSITY_WEBSITE,
        data_source: "manual",
        source_url: ADMISSIONS_HUB_URL,
        last_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    university = data;
    console.log(`Created university ${UNIVERSITY_NAME} (${university.id})`);
  } else {
    console.log(`Reusing existing university ${UNIVERSITY_NAME} (${university.id})`);
  }
  return university.id;
}

async function upsertProgram(universityId) {
  let { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("university_id", universityId)
    .ilike("official_name", PROGRAM_NAME)
    .maybeSingle();
  if (!program) {
    const { data, error } = await supabase
      .from("programs")
      .insert({
        university_id: universityId,
        official_name: PROGRAM_NAME,
        degree_type: "bachelor",
        field: "Architecture",
        language: "English",
        official_url: ARCHITECTURE_ADMISSION_URL,
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    program = data;
    console.log(`Created program ${PROGRAM_NAME} (${program.id})`);
  } else {
    // Backfill/repair in case an older run of this script (or the dead-URL
    // version) left the program pointing at a stale official_url.
    await supabase
      .from("programs")
      .update({ official_url: ARCHITECTURE_ADMISSION_URL, verified_at: new Date().toISOString() })
      .eq("id", program.id);
    console.log(`Reusing existing program ${PROGRAM_NAME} (${program.id})`);
  }
  return program.id;
}

async function upsertAdmissionCycle(programId) {
  let { data: cycle } = await supabase
    .from("admission_cycles")
    .select("id")
    .eq("program_id", programId)
    .eq("intake_year", 2026)
    .eq("intake_season", "fall")
    .maybeSingle();
  if (!cycle) {
    // ARCHED registration window closes 16 July 2026 (23:59:59 CEST) --
    // stated explicitly on ARCHITECTURE_ADMISSION_URL. Application fee and a
    // standardized English score are NOT stated on that page, so both stay
    // null rather than guessed.
    const { data, error } = await supabase
      .from("admission_cycles")
      .insert({
        program_id: programId,
        intake_year: 2026,
        intake_season: "fall",
        application_deadline: "2026-07-16T23:59:59+02:00",
        deadline_timezone: "Europe/Rome",
      })
      .select("id")
      .single();
    if (error) throw error;
    cycle = data;
    console.log(`Created admission cycle for ${PROGRAM_NAME} (${cycle.id})`);
  } else {
    console.log(`Reusing existing admission cycle for ${PROGRAM_NAME} (${cycle.id})`);
  }
  return cycle.id;
}

async function upsertSource({ pageType, officialUrl, entityColumn, entityId }) {
  let { data: source } = await supabase
    .from("sources")
    .select("id, official_url")
    .eq(entityColumn, entityId)
    .eq("page_type", pageType)
    .maybeSingle();
  if (!source) {
    const { data, error } = await supabase
      .from("sources")
      .insert({
        source_type: "official_website",
        official_url: officialUrl,
        publisher: UNIVERSITY_NAME,
        page_type: pageType,
        [entityColumn]: entityId,
        verified_at: new Date().toISOString(),
      })
      .select("id, official_url")
      .single();
    if (error) throw error;
    source = data;
    console.log(`Registered ${pageType} source ${source.id} -> ${source.official_url}`);
  } else if (source.official_url !== officialUrl) {
    // Repair a stale URL (e.g. the old dead /en/education/how-to-enrol link)
    // instead of leaving a second row or a broken source in place.
    await supabase.from("sources").update({ official_url: officialUrl, verified_at: new Date().toISOString() }).eq("id", source.id);
    console.log(`Updated ${pageType} source ${source.id}: ${source.official_url} -> ${officialUrl}`);
  } else {
    console.log(`Reusing existing ${pageType} source ${source.id} -> ${source.official_url}`);
  }
  return source.id;
}

async function upsertAdmissionRequirement({ admissionCycleId, sourceId, requirementType, title, description, minimumValue, confidence }) {
  const { data: existing } = await supabase
    .from("admission_requirements")
    .select("id")
    .eq("admission_cycle_id", admissionCycleId)
    .eq("requirement_type", requirementType)
    .maybeSingle();
  if (existing) {
    console.log(`Reusing existing "${requirementType}" admission requirement (${existing.id})`);
    return;
  }
  const { data, error } = await supabase
    .from("admission_requirements")
    .insert({
      admission_cycle_id: admissionCycleId,
      requirement_type: requirementType,
      title,
      description,
      required: true,
      minimum_value: minimumValue ?? null,
      source_id: sourceId,
      confidence,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`Registered "${requirementType}" admission requirement (${data.id})`);
}

async function main() {
  const universityId = await upsertUniversity();
  const programId = await upsertProgram(universityId);
  const cycleId = await upsertAdmissionCycle(programId);

  await upsertSource({ pageType: "university", officialUrl: UNIVERSITY_WEBSITE, entityColumn: "university_id", entityId: universityId });
  await upsertSource({ pageType: "admissions", officialUrl: ADMISSIONS_HUB_URL, entityColumn: "university_id", entityId: universityId });
  const architectureSourceId = await upsertSource({
    pageType: "admissions",
    officialUrl: ARCHITECTURE_ADMISSION_URL,
    entityColumn: "program_id",
    entityId: programId,
  });
  await upsertSource({ pageType: "tuition", officialUrl: TUITION_PAGE_URL, entityColumn: "program_id", entityId: programId });

  await upsertAdmissionRequirement({
    admissionCycleId: cycleId,
    sourceId: architectureSourceId,
    requirementType: "entrance_exam",
    title: "ARCHED admission test",
    description:
      "Compulsory entrance exam for Bachelor of Architecture admission. English-language sitting: 23 July 2026; Italian-language sitting: 24 July 2026.",
    confidence: "high",
  });
  await upsertAdmissionRequirement({
    admissionCycleId: cycleId,
    sourceId: architectureSourceId,
    requirementType: "language",
    title: "Italian language proficiency (non-EU applicants, Italian-taught track)",
    description:
      "CLIQ B2 certification or a passing score on the Cisia remote Italian test (2026 sitting: 14 July) is required for non-EU applicants to the Italian-taught track. Not required for the English-taught track.",
    minimumValue: "B2",
    confidence: "high",
  });

  console.log("\nDone. Sources have no snapshots or change_events yet --");
  console.log('that only happens once you click "Check source now" for real.');
  console.log(`Program id (for adding an application in the app UI): ${programId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
