import type { SourcePageType, SourceUrlStatus } from "@/app/lib/supabase/database.types";

/**
 * Shared vocabulary for what a `sources.url_status` value means, used by the
 * validator (validateSource.ts), the fallback-chain resolver
 * (officialUrl.ts), the Match engine (data/match.ts), and the Source Health
 * admin view (data/admin.ts) -- kept in one place so "what counts as broken"
 * can never drift between those call sites.
 *
 * Only `valid` and `redirected` are ever shown to a user as "Verified" (see
 * AGENTS.md task notes on Source Validation: "200〜299で実際のページ内容が取得できたSourceのみ
 * Verified"). `unknown` is deliberately treated as usable-but-unverified, not
 * broken -- a source that has simply never been checked yet must not be
 * hidden from the user the way a confirmed 404 is.
 */

export const VERIFIED_STATUSES: ReadonlySet<SourceUrlStatus> = new Set(["valid", "redirected"]);

/** Confirmed broken: the page is gone, or the URL doesn't even belong to the
 * expected official domain. Must never be shown as a clickable Official
 * Source -- the fallback chain skips these entirely. */
export const HARD_BROKEN_STATUSES: ReadonlySet<SourceUrlStatus> = new Set([
  "not_found",
  "gone",
  "invalid_domain",
]);

/** Inconclusive: our checker couldn't confirm the page is fine, but there's
 * no positive evidence it's broken either (a bot block, a timeout, or simply
 * never checked yet). Still shown to the user, just not labeled Verified. */
export const INCONCLUSIVE_STATUSES: ReadonlySet<SourceUrlStatus> = new Set(["blocked", "timeout", "unknown"]);

export function isVerifiedStatus(status: SourceUrlStatus): boolean {
  return VERIFIED_STATUSES.has(status);
}

export function isHardBroken(status: SourceUrlStatus): boolean {
  return HARD_BROKEN_STATUSES.has(status);
}

/** Usable = safe to show as a clickable link, even if not yet "Verified". */
export function isUsableStatus(status: SourceUrlStatus): boolean {
  return !isHardBroken(status);
}

/** Lower rank = preferred when multiple sources could serve as "the"
 * Official Source for an entity (see officialUrl.ts's fallback chain: a
 * program's own admissions page beats the university homepage). */
export function pageTypeRank(pageType: SourcePageType | null): number {
  switch (pageType) {
    case "program":
      return 0;
    case "admissions":
      return 1;
    case "deadline":
      return 2;
    case "tuition":
      return 3;
    case "language_requirement":
      return 4;
    case "scholarship":
      return 5;
    case "visa":
      return 6;
    case "university":
      return 7;
    case "other":
    case null:
      return 8;
    default:
      return 9;
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Scheduled re-validation cadence (see AGENTS.md task notes on Scheduled
 * source validation): healthy admissions-critical pages are checked daily,
 * other healthy pages weekly, and anything currently broken is retried
 * within half a day to a day so a fix (or a confirmed-still-broken state)
 * shows up quickly without hammering the official site.
 */
export function computeNextCheckDueAt(
  status: SourceUrlStatus,
  pageType: SourcePageType | null,
  consecutiveFailures: number,
  now: number = Date.now(),
): string {
  if (isVerifiedStatus(status)) {
    const isAdmissionsCritical = pageType === "admissions" || pageType === "deadline" || pageType === "tuition";
    return new Date(now + (isAdmissionsCritical ? 24 * HOUR_MS : 7 * DAY_MS)).toISOString();
  }
  // Back off slightly the more times in a row it's failed, capped at 24h, so
  // a source that's been broken for weeks doesn't get re-fetched every 12h
  // forever.
  const backoffHours = Math.min(12 + consecutiveFailures * 2, 24);
  return new Date(now + backoffHours * HOUR_MS).toISOString();
}
