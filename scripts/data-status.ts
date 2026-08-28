// Real University Data -- Data Coverage CLI (task brief item 33/34:
// `npm run data:status`). Prints the same real, live counts the Admin
// "Real Data Status" page shows (app/lib/data/admin.ts), from a plain Node
// script -- admin.ts itself imports "server-only" (Next-build-only, see
// scripts/import-universities.ts's note on the same constraint) and reads
// cookies for a per-request Supabase client, so this re-queries the same
// tables directly with a service-role client instead of importing it.
//
// Usage:
//   npm run data:status

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../app/lib/supabase/database.types.ts";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const [{ count: universities }, { count: programs }, { data: cycles }, { data: sources }, { data: universityRows }, { data: programRows }] =
    await Promise.all([
      supabase.from("universities").select("*", { count: "exact", head: true }),
      supabase.from("programs").select("*", { count: "exact", head: true }),
      supabase.from("admission_cycles").select("id, program_id, application_deadline").not("application_deadline", "is", null),
      supabase.from("sources").select("program_id, page_type, url_status").neq("source_type", "ror"),
      supabase.from("universities").select("country_code"),
      supabase.from("programs").select("field"),
    ]);

  const allSources = sources ?? [];
  const healthy = allSources.filter((s) => s.url_status === "valid").length;
  const broken = allSources.filter((s) => s.url_status === "not_found" || s.url_status === "gone" || s.url_status === "invalid_domain").length;
  const needsReview = allSources.length - healthy - broken - allSources.filter((s) => s.url_status === "redirected").length;

  const verifiedProgramIds = new Set(
    allSources.filter((s) => s.program_id && ["admissions", "deadline"].includes(s.page_type ?? "") && s.url_status === "valid").map((s) => s.program_id),
  );
  const verifiedAdmissions = (cycles ?? []).filter((c) => verifiedProgramIds.has(c.program_id)).length;

  const byCountry = new Map<string, number>();
  for (const row of universityRows ?? []) {
    const key = row.country_code ?? "Unknown";
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
  }
  const byField = new Map<string, number>();
  for (const row of programRows ?? []) {
    const key = row.field ?? "Unknown";
    byField.set(key, (byField.get(key) ?? 0) + 1);
  }

  console.log("DATA COVERAGE");
  console.log("");
  console.log(`Universities:        ${universities ?? 0}`);
  console.log(`Programs:            ${programs ?? 0}`);
  console.log(`Verified Admissions: ${verifiedAdmissions}`);
  console.log(`Sources:             ${allSources.length}`);
  console.log(`  Healthy:           ${healthy}`);
  console.log(`  Needs Review:      ${Math.max(0, needsReview)}`);
  console.log(`  Broken:            ${broken}`);
  console.log("");
  console.log("Coverage by Country");
  for (const [country, count] of [...byCountry.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${country.padEnd(10)} ${count}`);
  }
  console.log("");
  console.log("Coverage by Field");
  if (byField.size === 0) console.log("  (no programs yet)");
  for (const [field, count] of [...byField.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field.padEnd(24)} ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
