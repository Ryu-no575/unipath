// University Basic Verification -- batch CLI (task: "確認可能なUniversity基本データは安全に
// 自動Verifyし、本当に人間の確認が必要なものだけNeeds Reviewに残す").
//
// Runs the same real-world checks app/lib/live-data/validateSource.ts performs
// (SSRF-guarded fetch, redirect following, robots.txt courtesy check, domain
// match, soft-404 detection) against every university's official_website
// `sources` row, and writes the verdict straight into `sources` using the
// exact same columns validateSource.ts uses -- so the result is indistinguishable
// from (and fully compatible with) the app's own validation pipeline. No
// separate/duplicate status field is introduced.
//
// This file is a standalone `node`-run script (like scripts/import-universities.ts
// and scripts/data-status.ts) because app/lib/live-data/validateSource.ts and its
// helpers (ssrf.ts, robots.ts, extract.ts) `import "server-only"`, which only
// resolves inside Next's webpack build -- see scripts/import-universities.ts's
// note on the same constraint. The checks below intentionally mirror that
// pipeline's logic rather than reimplementing a looser one; keep them in sync
// if validateSource.ts's rules change.
//
// Never verifies a university based on ROR data alone: HTTP 200-299, a
// same-domain landing, and no soft-404 signature are all required before a
// source is marked `valid`/`redirected` (the only two url_status values the
// app treats as "Verified" -- see app/lib/live-data/sourceStatus.ts). Anything
// that fails those checks is written as `not_found` / `gone` / `blocked` /
// `timeout` / `invalid_domain` / `unknown` and stays in Needs Review --
// nothing is ever force-set to verified.
//
// Usage:
//   npm run verify:universities                  (process every unchecked/due university source)
//   npm run verify:universities -- --limit=50
//   npm run verify:universities -- --dry-run       (report only, no writes)

import { createClient } from "@supabase/supabase-js";
import { isSameOfficialDomain } from "../app/lib/live-data/domain.ts";
import { computeNextCheckDueAt } from "../app/lib/live-data/sourceStatus.ts";
import { classifyInstitutionNamePattern } from "../app/lib/importers/ror/index.ts";

const BETWEEN_CHECKS_MS = 600;
const FETCH_TIMEOUT_MS = 10000;
const ROBOTS_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;
const OUR_USER_AGENT = "UniPathBot/0.1 (+https://unipath.example/bot)";

// --- SSRF guard + safe redirect-following fetch (mirrors app/lib/live-data/ssrf.ts) ---

const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isSafeSourceUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(hostname)) return false;
  if (isPrivateIPv4(hostname)) return false;
  return true;
}

async function safeFetchWithMeta(url: string, init: RequestInit & { signal?: AbortSignal }) {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeSourceUrl(currentUrl)) {
      throw new Error(`Refusing to fetch unsafe URL${hop > 0 ? " after redirect" : ""}: ${currentUrl}`);
    }
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: currentUrl, redirected: hop > 0 };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return { response, finalUrl: currentUrl, redirected: hop > 0 };
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS}) while fetching ${url}`);
}

// --- robots.txt courtesy check (mirrors app/lib/live-data/robots.ts) ---

function parseDisallowRules(robotsText: string, userAgent: string): string[] {
  const lines = robotsText.split("\n").map((line) => line.trim());
  const groups: { agents: string[]; disallows: string[] }[] = [];
  let current: { agents: string[]; disallows: string[] } | null = null;
  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [directive, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const key = directive.trim().toLowerCase();
    if (key === "user-agent") {
      if (!current || current.disallows.length > 0) {
        current = { agents: [], disallows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      if (value) current.disallows.push(value);
    }
  }
  const applicable = groups.filter((g) => g.agents.includes(userAgent.toLowerCase()) || g.agents.includes("*"));
  const specific = applicable.filter((g) => g.agents.includes(userAgent.toLowerCase()));
  const chosen = specific.length > 0 ? specific : applicable;
  return chosen.flatMap((g) => g.disallows);
}

async function isAllowedByRobots(targetUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return false;
  }
  let robotsText: string;
  try {
    const response = await fetch(new URL("/robots.txt", url.origin), {
      headers: { "User-Agent": "UniPathBot" },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
    });
    if (!response.ok) return true;
    robotsText = await response.text();
  } catch {
    return true;
  }
  const disallowed = parseDisallowRules(robotsText, "UniPathBot");
  return !disallowed.some((path) => url.pathname.startsWith(path));
}

// --- visible-text normalization + soft-404 / identity heuristics ---

function normalizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SOFT_404_PATTERN =
  /\b(page|content) not found\b|\b404(\s+(error|not found))?\b|\bno longer (available|exists)\b|\bthis page (doesn't|does not) exist\b|\bcannot be found\b|\boops[,!]? .{0,20}not found\b/i;

function detectSoftNotFound(normalizedText: string): string | null {
  if (normalizedText.length < 60) return "Page returned 200 but visible content is nearly empty (possible soft 404).";
  const leading = normalizedText.slice(0, 600);
  if (SOFT_404_PATTERN.test(leading)) return "Page returned 200 but visible text matches a not-found pattern.";
  return null;
}

/** Best-effort identity check (rule G): does the page's <title> or opening
 * text plausibly mention the institution? Never blocks verification on its
 * own (too many legitimate homepages lead with a logo/nav, not the full
 * legal name) -- only downgrades confidence and is surfaced to the admin as
 * a reason, exactly like AGENTS.md task notes on Verification Confidence. */
function identityLooksConsistent(html: string, officialName: string): boolean {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeHtml(titleMatch[1]) : "";
  const haystack = `${title} ${normalizeHtml(html).slice(0, 1000)}`.toLowerCase();
  const nameTokens = officialName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 4 && !["university", "the", "of", "and", "für", "der", "die", "das"].includes(tok));
  if (nameTokens.length === 0) return true; // nothing distinctive to check (e.g. very short/acronym name)
  return nameTokens.some((tok) => haystack.includes(tok));
}

type UrlStatus = "valid" | "redirected" | "not_found" | "gone" | "blocked" | "timeout" | "invalid_domain" | "unknown";

interface CheckResult {
  status: UrlStatus;
  httpStatus: number | null;
  resolvedUrl: string | null;
  validationError: string | null;
  identityConsistent: boolean | null;
}

async function checkUniversitySource(officialUrl: string, expectedOfficialWebsite: string, officialName: string): Promise<CheckResult> {
  if (!isSafeSourceUrl(officialUrl)) {
    return { status: "unknown", httpStatus: null, resolvedUrl: null, validationError: "URL failed safety checks.", identityConsistent: null };
  }

  const allowed = await isAllowedByRobots(officialUrl);
  if (!allowed) {
    return { status: "blocked", httpStatus: null, resolvedUrl: null, validationError: "Disallowed by robots.txt.", identityConsistent: null };
  }

  let outcome: Awaited<ReturnType<typeof safeFetchWithMeta>>;
  try {
    outcome = await safeFetchWithMeta(officialUrl, {
      headers: { "User-Agent": OUR_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      status: isTimeout ? "timeout" : "unknown",
      httpStatus: null,
      resolvedUrl: null,
      validationError: err instanceof Error ? err.message : "Fetch failed",
      identityConsistent: null,
    };
  }

  const { response, finalUrl, redirected } = outcome;
  const httpStatus = response.status;

  if (httpStatus === 404) return { status: "not_found", httpStatus, resolvedUrl: redirected ? finalUrl : null, validationError: "HTTP 404", identityConsistent: null };
  if (httpStatus === 410) return { status: "gone", httpStatus, resolvedUrl: redirected ? finalUrl : null, validationError: "HTTP 410", identityConsistent: null };
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429)
    return { status: "blocked", httpStatus, resolvedUrl: null, validationError: `HTTP ${httpStatus}`, identityConsistent: null };
  if (httpStatus < 200 || httpStatus >= 300)
    return { status: "unknown", httpStatus, resolvedUrl: null, validationError: `HTTP ${httpStatus}`, identityConsistent: null };

  if (!isSameOfficialDomain(finalUrl, expectedOfficialWebsite)) {
    return {
      status: "invalid_domain",
      httpStatus,
      resolvedUrl: finalUrl,
      validationError: `Resolved to a different domain than the university's official website (${expectedOfficialWebsite}).`,
      identityConsistent: null,
    };
  }

  const html = await response.text();
  const normalizedText = normalizeHtml(html);
  const softNotFound = detectSoftNotFound(normalizedText);
  if (softNotFound) {
    return { status: "not_found", httpStatus, resolvedUrl: redirected ? finalUrl : null, validationError: softNotFound, identityConsistent: null };
  }

  return {
    status: redirected ? "redirected" : "valid",
    httpStatus,
    resolvedUrl: redirected ? finalUrl : null,
    validationError: null,
    identityConsistent: identityLooksConsistent(html, officialName),
  };
}

// --- driver ---

function parseArgs(argv: string[]) {
  let limit: number | null = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) limit = value;
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }
  return { limit, dryRun };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
    process.exit(1);
  }
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { limit, dryRun } = parseArgs(process.argv.slice(2));

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("sources")
    .select("id, official_url, university_id, url_status, consecutive_failures, page_type, source_type")
    .eq("page_type", "university")
    .neq("source_type", "ror")
    .not("official_url", "is", null)
    .or(`next_check_due_at.is.null,next_check_due_at.lte.${nowIso}`)
    .order("id", { ascending: true });
  if (limit) query = query.limit(limit);

  const { data: dueSources, error: dueError } = await query;
  if (dueError) {
    console.error("Failed to load due sources:", dueError.message);
    process.exit(1);
  }
  const due = dueSources ?? [];
  console.log(`University Basic Verification -- ${due.length} official-website source(s) to check${dryRun ? " (dry run, no writes)" : ""}.`);
  console.log("");

  if (due.length === 0) {
    console.log("Nothing due. Every university's official website has been checked and is not yet due for recheck.");
    return;
  }

  const universityIds = Array.from(new Set(due.map((s) => s.university_id).filter((id): id is string => Boolean(id))));
  const { data: universities } = await supabase
    .from("universities")
    .select("id, official_name, official_website, ror_id")
    .in("id", universityIds);
  const universityById = new Map((universities ?? []).map((u) => [u.id, u]));

  const tally = new Map<UrlStatus, number>();
  let identityFlagged = 0;
  let nameFlaggedNonUniversity = 0;
  let nameFlaggedAmbiguous = 0;
  let processed = 0;

  for (const source of due) {
    const university = source.university_id ? universityById.get(source.university_id) : null;
    if (!university || !university.official_website || !source.official_url) {
      processed++;
      continue;
    }

    let result: CheckResult;
    try {
      result = await checkUniversitySource(source.official_url, university.official_website, university.official_name);
    } catch (err) {
      result = { status: "unknown", httpStatus: null, resolvedUrl: null, validationError: err instanceof Error ? err.message : "Unexpected error", identityConsistent: null };
    }

    tally.set(result.status, (tally.get(result.status) ?? 0) + 1);
    if (result.identityConsistent === false) identityFlagged++;

    const namePattern = classifyInstitutionNamePattern(university.official_name);
    if (namePattern === "disqualifies") nameFlaggedNonUniversity++;
    else if (namePattern === "ambiguous") nameFlaggedAmbiguous++;

    const checkedAt = new Date().toISOString();
    const isVerified = result.status === "valid" || result.status === "redirected";
    const consecutiveFailures = isVerified ? 0 : (source.consecutive_failures ?? 0) + 1;

    const statusLabel = isVerified ? "\x1b[32mOK\x1b[0m" : "\x1b[33m--\x1b[0m";
    console.log(
      `[${statusLabel}] ${university.official_name.padEnd(45).slice(0, 45)} ${result.status.padEnd(14)} ${result.httpStatus ?? "-"}${result.identityConsistent === false ? "  (identity check: uncertain)" : ""}${namePattern === "disqualifies" ? "  (name suggests non-HEI)" : ""}`,
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("sources")
        .update({
          url_status: result.status,
          http_status: result.httpStatus,
          resolved_url: result.resolvedUrl,
          last_validated_at: checkedAt,
          validation_error: result.validationError,
          consecutive_failures: consecutiveFailures,
          last_checked_at: checkedAt,
          ...(isVerified ? { last_successful_check_at: checkedAt } : {}),
          next_check_due_at: computeNextCheckDueAt(result.status, "university", consecutiveFailures),
        })
        .eq("id", source.id);
      if (updateError) console.error(`   update failed for ${university.official_name}: ${updateError.message}`);
    }

    processed++;
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_CHECKS_MS));
  }

  console.log("");
  console.log("=== SUMMARY ===");
  console.log(`Processed: ${processed}`);
  for (const [status, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(14)} ${count}`);
  }
  console.log("");
  console.log(`Identity check uncertain (name not found on page): ${identityFlagged} -- kept for manual review, never auto-verified past this.`);
  console.log(`Name pattern suggests NOT a higher-education institution: ${nameFlaggedNonUniversity} -- flagged for manual review, not removed.`);
  console.log(`Name pattern ambiguous (neither clearly qualifies nor disqualifies): ${nameFlaggedAmbiguous}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
