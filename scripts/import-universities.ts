// Real University Data v1 -- imports real institutions from ROR (Research
// Organization Registry) into Supabase `universities`, deduplicated by
// ror_id. This is the only supported way real rows get into `universities`;
// the app itself never lets a client write to that table (see
// supabase/migrations/20260825120100_row_level_security.sql).
//
// Default mode: bulk country-based import (Real University Data Phase 2 --
// see AGENTS.md task notes: "「大学名だけ大量にhardcodeする」は禁止です. University基本情報は
// ROR等の信頼できるopen dataから取得してください"). Which universities exist for a
// country comes entirely from ROR's own data (app/lib/importers/ror/index.ts
// pages through ROR's search results and applies a quality filter) -- the
// list below is only which *countries* to seed from, spanning the regions
// AGENTS.md calls out (Europe, US, Canada, UK, Australia, Asia) as a
// starting point, not an architectural limit; pass --countries to use a
// different set.
//
// Usage:
//   npm run import:universities                        (default: ~120 universities across the seed countries)
//   npm run sync:universities                           (identical -- alias)
//   node --env-file=.env.local scripts/import-universities.ts --target=200
//   node --env-file=.env.local scripts/import-universities.ts --countries=US,GB,JP
//   node --env-file=.env.local scripts/import-universities.ts --names="Politecnico di Milano,ETH Zurich"
//
// Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in
// .env.local (both npm scripts pass --env-file=.env.local for you). Prints
// Imported / Updated / Skipped / Errors -- never prints the service role key
// itself.
//
// Run directly with `node` (no build step, no ts-node/tsx dependency) --
// Node's built-in TypeScript support strips types at load time. Because of
// that, every relative import in this file and in
// app/lib/importers/ror/index.ts must use an explicit .ts extension: Node's
// ESM resolver (unlike Next's bundler) does not add extensions for you.

import { createClient } from "@supabase/supabase-js";
import {
  importUniversitiesByName,
  importUniversitiesForCountries,
  type ImportSummary,
} from "../app/lib/importers/ror/index.ts";
import type { Database } from "../app/lib/supabase/database.types.ts";

// Default seed: broad enough to span every region AGENTS.md names as a
// primary overseas-study destination, without being exhaustive or fixed to
// one region -- importUniversitiesForCountries accepts any ISO country list.
const DEFAULT_SEED_COUNTRIES = [
  "US", "GB", "CA", "AU", "NZ", // North America / UK / Oceania
  "DE", "FR", "NL", "IT", "ES", "CH", "SE", "DK", "FI", "IE", "BE", "AT", "PT", "NO", "PL", "CZ", "GR", "HU", // Europe
  "JP", "KR", "SG", "HK", "CN", "TW", "MY", "IN", "TH", "VN", "PH", "ID", // East / Southeast Asia
  "AE", "SA", "QA", "IL", "TR", // Middle East
];
const DEFAULT_TARGET_TOTAL = 320;
const DEFAULT_PER_COUNTRY_CAP = 12;

function parseArgs(argv: string[]): { countries?: string[]; target?: number; names?: string[] } {
  const result: { countries?: string[]; target?: number; names?: string[] } = {};
  for (const arg of argv) {
    if (arg.startsWith("--countries=")) {
      result.countries = arg
        .slice("--countries=".length)
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg.startsWith("--target=")) {
      const value = Number(arg.slice("--target=".length));
      if (Number.isFinite(value) && value > 0) result.target = value;
    } else if (arg.startsWith("--names=")) {
      result.names = arg
        .slice("--names=".length)
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
    }
  }
  return result;
}

function printSummary(summary: ImportSummary): void {
  console.log("");
  console.log(`Imported: ${summary.imported}`);
  console.log(`Updated:  ${summary.updated}`);
  console.log(`Skipped:  ${summary.skipped}`);
  console.log(`Errors:   ${summary.errors}`);
  console.log("");

  for (const result of summary.results) {
    if (result.status === "error") {
      console.log(`  [error]   ${result.query} -- ${result.error}`);
    } else {
      console.log(`  [${result.status}] ${result.officialName} (${result.rorId})`);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const args = parseArgs(process.argv.slice(2));

  if (args.names) {
    console.log(`Importing ${args.names.length} universities from ROR by name...`);
    const summary = await importUniversitiesByName(supabase, args.names);
    printSummary(summary);
    if (summary.errors > 0) process.exit(1);
    return;
  }

  const countries = args.countries ?? DEFAULT_SEED_COUNTRIES;
  const target = args.target ?? DEFAULT_TARGET_TOTAL;
  console.log(
    `Importing up to ${target} universities from ROR across ${countries.length} countries (${countries.join(", ")})...`,
  );
  const summary = await importUniversitiesForCountries(supabase, countries, target, DEFAULT_PER_COUNTRY_CAP);
  printSummary(summary);

  if (summary.errors > 0 && summary.imported + summary.updated === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
