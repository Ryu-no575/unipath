import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/lib/supabase/admin";
import type { Database, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isSafeSourceUrl, safeFetchWithMeta } from "./ssrf";
import { isAllowedByRobots } from "./robots";
import { isSameOfficialDomain } from "./domain";
import { normalizeHtml } from "./extract";
import { computeNextCheckDueAt } from "./sourceStatus";

type Client = SupabaseClient<Database>;
type SourceRow = Database["public"]["Tables"]["sources"]["Row"];

const FETCH_TIMEOUT_MS = 10000;
const OUR_USER_AGENT = "UniPathBot/0.1 (+https://unipath.example/bot)";

/** Source types that are intentionally NOT expected to live on the
 * university's own domain (a registry record, not the university's site
 * pretending to be official) -- exempted from the domain check so they never
 * get flagged `invalid_domain`. See app/lib/importers/ror/index.ts. */
const DOMAIN_CHECK_EXEMPT_SOURCE_TYPES = new Set(["ror"]);

const SOFT_404_PATTERN =
  /\b(page|content) not found\b|\b404(\s+(error|not found))?\b|\bno longer (available|exists)\b|\bthis page (doesn't|does not) exist\b|\bcannot be found\b|\boops[,!]? .{0,20}not found\b/i;

export interface ValidateSourceResult {
  status: SourceUrlStatus;
  httpStatus: number | null;
  resolvedUrl: string | null;
  validationError: string | null;
  /** Only populated on a successful (valid/redirected) fetch -- lets
   * checkSource() reuse this fetch instead of hitting the official site a
   * second time for content-diffing. Never consumed outside this module and
   * checkSource.ts. */
  html: string | null;
}

/**
 * Finds the official domain a source's URL is expected to live on, by
 * walking up to whichever university owns it (directly, via its program, or
 * via its admission cycle). Returns null when the entity chain can't be
 * resolved or the university has no known website -- callers must skip the
 * domain check in that case rather than falsely flag `invalid_domain`.
 */
async function resolveExpectedOfficialWebsite(client: Client, source: SourceRow): Promise<string | null> {
  if (source.university_id) {
    const { data } = await client
      .from("universities")
      .select("official_website")
      .eq("id", source.university_id)
      .maybeSingle();
    return data?.official_website ?? null;
  }

  if (source.program_id) {
    const { data: program } = await client
      .from("programs")
      .select("university_id")
      .eq("id", source.program_id)
      .maybeSingle();
    if (!program) return null;
    const { data: university } = await client
      .from("universities")
      .select("official_website")
      .eq("id", program.university_id)
      .maybeSingle();
    return university?.official_website ?? null;
  }

  if (source.admission_cycle_id) {
    const { data: cycle } = await client
      .from("admission_cycles")
      .select("program_id")
      .eq("id", source.admission_cycle_id)
      .maybeSingle();
    if (!cycle) return null;
    const { data: program } = await client
      .from("programs")
      .select("university_id")
      .eq("id", cycle.program_id)
      .maybeSingle();
    if (!program) return null;
    const { data: university } = await client
      .from("universities")
      .select("official_website")
      .eq("id", program.university_id)
      .maybeSingle();
    return university?.official_website ?? null;
  }

  return null;
}

/**
 * Deliberately conservative: a status/HTTP outcome only ever gets promoted
 * to `not_found` on strong textual evidence of a soft-404 (a 200 response
 * for a page that's actually an error page dressed up with a 200 status --
 * common on CMS-driven university sites). Anything ambiguous stays `valid`
 * rather than risk hiding a real page.
 */
function detectSoftNotFound(normalizedText: string): string | null {
  if (normalizedText.length < 60) return "Page returned 200 but visible content is nearly empty (possible soft 404).";
  const leading = normalizedText.slice(0, 600);
  if (SOFT_404_PATTERN.test(leading)) return "Page returned 200 but visible text matches a not-found pattern.";
  return null;
}

/**
 * The single server-side pipeline that turns a stored `sources.official_url`
 * into a trustworthy verdict: fetch it (SSRF-guarded, redirect-following,
 * robots.txt-respecting), classify the outcome into one of the 8
 * `SourceUrlStatus` values, confirm it landed on the expected official
 * domain, and persist all of that onto the `sources` row -- so "Verified" in
 * the UI is never just "a URL string exists" (see AGENTS.md task notes on
 * Source Validation).
 *
 * Called directly by the scheduler (scheduler.ts) for due sources, and by
 * checkSource.ts as the first phase of "Check source now" -- checkSource
 * only proceeds to content-diffing when this returns `valid` or `redirected`,
 * reusing the `html` this function already fetched rather than fetching
 * twice.
 */
export async function validateSource(sourceId: string): Promise<ValidateSourceResult> {
  const supabase = createAdminClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();

  const checkedAt = new Date().toISOString();

  if (sourceError || !source || !source.official_url) {
    return {
      status: "unknown",
      httpStatus: null,
      resolvedUrl: null,
      validationError: sourceError?.message ?? "Source not found or has no official_url.",
      html: null,
    };
  }

  const writeResult = async (result: ValidateSourceResult, consecutiveFailures: number): Promise<ValidateSourceResult> => {
    await supabase
      .from("sources")
      .update({
        url_status: result.status,
        http_status: result.httpStatus,
        resolved_url: result.resolvedUrl,
        last_validated_at: checkedAt,
        validation_error: result.validationError,
        consecutive_failures: consecutiveFailures,
        last_checked_at: checkedAt,
        ...(result.status === "valid" || result.status === "redirected"
          ? { last_successful_check_at: checkedAt }
          : {}),
        next_check_due_at: computeNextCheckDueAt(result.status, source.page_type, consecutiveFailures),
      })
      .eq("id", sourceId);
    return result;
  };

  const priorFailures = source.consecutive_failures ?? 0;

  if (!isSafeSourceUrl(source.official_url)) {
    return writeResult(
      { status: "unknown", httpStatus: null, resolvedUrl: null, validationError: "URL failed safety checks.", html: null },
      priorFailures + 1,
    );
  }

  const allowed = await isAllowedByRobots(source.official_url);
  if (!allowed) {
    return writeResult(
      { status: "blocked", httpStatus: null, resolvedUrl: null, validationError: "Disallowed by robots.txt.", html: null },
      priorFailures + 1,
    );
  }

  let fetchOutcome: Awaited<ReturnType<typeof safeFetchWithMeta>>;
  try {
    fetchOutcome = await safeFetchWithMeta(source.official_url, {
      headers: { "User-Agent": OUR_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return writeResult(
      {
        status: isTimeout ? "timeout" : "unknown",
        httpStatus: null,
        resolvedUrl: null,
        validationError: err instanceof Error ? err.message : "Fetch failed",
        html: null,
      },
      priorFailures + 1,
    );
  }

  const { response, finalUrl, redirected } = fetchOutcome;
  const httpStatus = response.status;

  if (httpStatus === 404) {
    return writeResult(
      { status: "not_found", httpStatus, resolvedUrl: redirected ? finalUrl : null, validationError: "HTTP 404", html: null },
      priorFailures + 1,
    );
  }
  if (httpStatus === 410) {
    return writeResult(
      { status: "gone", httpStatus, resolvedUrl: redirected ? finalUrl : null, validationError: "HTTP 410", html: null },
      priorFailures + 1,
    );
  }
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) {
    return writeResult(
      { status: "blocked", httpStatus, resolvedUrl: null, validationError: `HTTP ${httpStatus}`, html: null },
      priorFailures + 1,
    );
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return writeResult(
      { status: "unknown", httpStatus, resolvedUrl: null, validationError: `HTTP ${httpStatus}`, html: null },
      priorFailures + 1,
    );
  }

  // 2xx from here on -- still need the domain check and a soft-404 sniff
  // before this counts as genuinely Verified.
  const expectedOfficialWebsite = DOMAIN_CHECK_EXEMPT_SOURCE_TYPES.has(source.source_type)
    ? null
    : await resolveExpectedOfficialWebsite(supabase, source);

  if (expectedOfficialWebsite && !isSameOfficialDomain(finalUrl, expectedOfficialWebsite)) {
    return writeResult(
      {
        status: "invalid_domain",
        httpStatus,
        resolvedUrl: finalUrl,
        validationError: `Resolved to a different domain than the university's official website (${expectedOfficialWebsite}).`,
        html: null,
      },
      priorFailures + 1,
    );
  }

  const html = await response.text();
  const normalizedText = normalizeHtml(html);
  const softNotFoundReason = detectSoftNotFound(normalizedText);
  if (softNotFoundReason) {
    return writeResult(
      { status: "not_found", httpStatus, resolvedUrl: redirected ? finalUrl : null, validationError: softNotFoundReason, html: null },
      priorFailures + 1,
    );
  }

  const result: ValidateSourceResult = {
    status: redirected ? "redirected" : "valid",
    httpStatus,
    resolvedUrl: redirected ? finalUrl : null,
    validationError: null,
    html,
  };
  return writeResult(result, 0);
}
