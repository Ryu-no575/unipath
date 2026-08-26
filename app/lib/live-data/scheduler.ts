import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";
import { checkSource } from "./checkSource";

/** Politeness gap between consecutive validations in a batch run -- the same
 * spirit as app/lib/importers/ror/index.ts's BETWEEN_REQUESTS_MS, but for
 * hitting many different official sites rather than one API. */
const BETWEEN_CHECKS_MS = 500;

export interface SourceDue {
  id: string;
  officialUrl: string | null;
}

/**
 * Sources whose `next_check_due_at` has passed (or was never set, meaning
 * "never validated") -- the query the scheduled-validation architecture is
 * built around (see AGENTS.md task notes on Scheduled source validation).
 * Cheap: relies on the sources_next_check_due_at_idx index, not a full scan.
 */
export async function getSourcesDueForValidation(limit: number): Promise<SourceDue[]> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from("sources")
    .select("id, official_url, next_check_due_at")
    .not("official_url", "is", null)
    .or(`next_check_due_at.is.null,next_check_due_at.lte.${nowIso}`)
    .order("next_check_due_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  return (data ?? []).map((row) => ({ id: row.id, officialUrl: row.official_url }));
}

export interface RunDueValidationsSummary {
  attempted: number;
  results: { sourceId: string; status: string }[];
}

/**
 * Runs `checkSource()` (validate + diff, see checkSource.ts) against every
 * source currently due, one at a time with a short delay between requests.
 * This is the whole "scheduled validation" engine for v1 -- there is no
 * separate always-on crawler process; something external (a cron job, a
 * platform's scheduled function, or the manual "Validate due sources now"
 * admin action) just needs to call this periodically. Deliberately capped
 * per call via `limit` rather than draining the whole due-queue, so a single
 * invocation can never turn into an unbounded crawl (see AGENTS.md task
 * notes: "今回は大量crawlしなくて構いません").
 */
export async function runDueValidations(limit = 20): Promise<RunDueValidationsSummary> {
  const due = await getSourcesDueForValidation(limit);
  const results: { sourceId: string; status: string }[] = [];

  for (const source of due) {
    try {
      const result = await checkSource(source.id);
      results.push({ sourceId: source.id, status: result.status });
    } catch (err) {
      results.push({ sourceId: source.id, status: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_CHECKS_MS));
  }

  return { attempted: due.length, results };
}
