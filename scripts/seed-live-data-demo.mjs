// Seed Data (see AGENTS.md task notes on Demo vs. Seed vs. real data) --
// NOT run automatically, NOT part of the app, NOT the crawler. A small,
// local, manual tool for a developer to verify the Verified Live Data System
// end to end in the browser (Latest Updates + Notifications) against their
// own Supabase project, before any real checkSource() run has happened.
//
// It seeds one real institution (Politecnico di Milano) with a realistic
// "English requirement raised from IELTS 6.0 to 6.5" change -- the exact
// example from the product spec -- linked to a source, a before/after
// snapshot pair, one change_event, and a notification for the account you
// pass in. Everything it writes is clearly a manual seed (change_events.
// is_simulated = true), not a claim that UniPath verified this change
// against the live page right now.
//
// Refuses to run when NODE_ENV=production. This writes directly into
// change_events/notifications, which Latest Updates and the Notification
// Bell render as if they were real detections, so it must never touch a
// production Supabase project. Unlike app/lib/live-data/simulate.ts (which
// requires NODE_ENV === "development" because it always runs inside `next
// dev`), this script is invoked by hand outside Next, where NODE_ENV is
// typically unset even for a legitimate local run -- so this only blocks the
// explicit "production" case rather than requiring "development" (see
// AGENTS.md task notes on Demo separation).
//
// Usage (after applying supabase/migrations/20260826210000_..._system.sql):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-live-data-demo.mjs you@example.com
//
// Requires: an existing signed-up account for that email, which has already
// completed onboarding (so it has a profiles row) -- run this after signing
// up and completing onboarding in the app.

import { createClient } from "@supabase/supabase-js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: NODE_ENV is 'production'. This script writes simulated change data and must only run against a development Supabase project.");
  process.exit(1);
}

const [, , email] = process.argv;
if (!email) {
  console.error("Usage: node scripts/seed-live-data-demo.mjs <your-account-email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(targetEmail) {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    throw new Error(`No signed-up user found for ${email}. Sign up and finish onboarding first.`);
  }

  const universityName = "Politecnico di Milano";
  let { data: university } = await supabase
    .from("universities")
    .select("id")
    .ilike("official_name", universityName)
    .maybeSingle();
  if (!university) {
    const { data, error } = await supabase
      .from("universities")
      .insert({
        official_name: universityName,
        country_code: "IT",
        city: "Milan",
        official_website: "https://www.polimi.it/en/",
      })
      .select("id")
      .single();
    if (error) throw error;
    university = data;
  }

  const programName = "BSc Architecture";
  let { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("university_id", university.id)
    .ilike("official_name", programName)
    .maybeSingle();
  if (!program) {
    const { data, error } = await supabase
      .from("programs")
      .insert({
        university_id: university.id,
        official_name: programName,
        degree_type: "bachelor",
        field: "Architecture",
        language: "English",
        official_url: "https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/architecture",
      })
      .select("id")
      .single();
    if (error) throw error;
    program = data;
  }

  let { data: cycle } = await supabase
    .from("admission_cycles")
    .select("id")
    .eq("program_id", program.id)
    .eq("intake_year", 2027)
    .eq("intake_season", "fall")
    .maybeSingle();
  if (!cycle) {
    const { data, error } = await supabase
      .from("admission_cycles")
      .insert({ program_id: program.id, intake_year: 2027, intake_season: "fall" })
      .select("id")
      .single();
    if (error) throw error;
    cycle = data;
  }

  let { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("program_id", program.id)
    .maybeSingle();
  if (!source) {
    const { data, error } = await supabase
      .from("sources")
      .insert({
        source_type: "official_website",
        official_url: "https://www.polimi.it/en/prospective-students/how-to-apply/admission-to-laurea-programmes/architecture",
        publisher: "Politecnico di Milano",
        page_type: "language_requirement",
        program_id: program.id,
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    source = data;
  }

  // Application (status "considering" = saved) -- this is what makes the
  // applications_insert_watch_subscription trigger create a
  // watch_subscriptions row automatically.
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
      admission_cycle_id: cycle.id,
      status: "considering",
    });
    if (error) throw error;
  }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  await supabase.from("source_snapshots").insert([
    {
      source_id: source.id,
      content_hash: "seed-before",
      extracted_data: { min_english_score: { value: "6.0", confidence: "high" } },
      retrieved_at: new Date(twoHoursAgo.getTime() - 60 * 60 * 1000).toISOString(),
    },
    {
      source_id: source.id,
      content_hash: "seed-after",
      extracted_data: { min_english_score: { value: "6.5", confidence: "high" } },
      retrieved_at: twoHoursAgo.toISOString(),
    },
  ]);

  const { data: changeEvent, error: changeEventError } = await supabase
    .from("change_events")
    .insert({
      source_id: source.id,
      entity_type: "program",
      entity_id: program.id,
      field_name: "min_english_score",
      old_value: "6.0",
      new_value: "6.5",
      change_type: "value_changed",
      importance: "critical",
      review_status: "applied",
      is_simulated: true,
      detected_at: twoHoursAgo.toISOString(),
    })
    .select("id")
    .single();
  if (changeEventError) throw changeEventError;

  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: userId,
    change_event_id: changeEvent.id,
    title: `${universityName} — ${programName}: English requirement changed`,
    message: 'English requirement changed from "6.0" to "6.5" on the official source.',
    read: false,
    created_at: twoHoursAgo.toISOString(),
  });
  if (notificationError) throw notificationError;

  console.log(`Seeded a change_event + notification for ${email}.`);
  console.log("Sign in and check the dashboard's Latest Updates and the notification bell.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
