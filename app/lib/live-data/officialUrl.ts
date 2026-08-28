import type { SourcePageType, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isHardBroken, isVerifiedStatus, pageTypeRank } from "./sourceStatus";

/** The subset of a `sources` row this resolver needs -- deliberately a
 * structural type so both data/match.ts and data/sources.ts can pass their
 * own lightly-different Supabase select shapes without an extra mapping
 * step. */
export interface OfficialSourceLite {
  id: string;
  officialUrl: string | null;
  resolvedUrl: string | null;
  urlStatus: SourceUrlStatus;
  pageType: SourcePageType | null;
  sourceType: string;
  replacedBySourceId: string | null;
  /** An admin has reviewed this source and decided it's not a legitimate
   * official page for the entity it's attached to (see
   * 20260829000000_admin_roles_v1.sql) -- excluded from the fallback chain
   * entirely, the same as a hard-broken URL, regardless of urlStatus. */
  adminRejected?: boolean;
}

export type OfficialSourceOutcome =
  | { status: "verified"; url: string; sourceId: string }
  // sourceId is null when this is the last-resort university website, not a
  // tracked `sources` row.
  | { status: "unverified"; url: string; sourceId: string | null }
  | { status: "unavailable"; url: null; sourceId: null };

const MAX_REPLACEMENT_HOPS = 3;

function followReplacements(
  source: OfficialSourceLite,
  byId: Map<string, OfficialSourceLite>,
): OfficialSourceLite {
  let current = source;
  for (let hop = 0; hop < MAX_REPLACEMENT_HOPS; hop++) {
    if (!current.replacedBySourceId) return current;
    const next = byId.get(current.replacedBySourceId);
    if (!next) return current;
    current = next;
  }
  return current;
}

/**
 * The "click Official Source, never land on a 404" fallback chain (see
 * AGENTS.md task notes on Broken URL fallback): a program's own page beats
 * its university's admissions hub, which beats the university homepage --
 * but a source that's confirmed broken (`not_found` / `gone` /
 * `invalid_domain`) is skipped entirely rather than ever being handed to the
 * user, however specific it is. Never substitutes an aggregator
 * (Studyportals, Wikipedia, ...) for a missing official page -- those are
 * simply not in `sources` at all, by construction (see
 * app/lib/importers/ror/index.ts and scripts/register-poc-source.mjs).
 *
 * `sources` never usable at all (or only hard-broken ones) resolves to
 * `unavailable`; the caller must render that as "being re-verified", never
 * as a dead link.
 */
export function resolveBestOfficialUrl(
  sources: OfficialSourceLite[],
  fallbackWebsite: string | null,
): OfficialSourceOutcome {
  const byId = new Map(sources.map((s) => [s.id, s]));

  const candidates = sources
    .map((s) => followReplacements(s, byId))
    // A registry record (ROR) is a provenance reference, not the
    // university's own page -- never offered as "the" Official Source link.
    .filter((s) => s.sourceType !== "ror" && !isHardBroken(s.urlStatus) && !s.adminRejected)
    .sort((a, b) => pageTypeRank(a.pageType) - pageTypeRank(b.pageType));

  for (const candidate of candidates) {
    const url = candidate.resolvedUrl ?? candidate.officialUrl;
    if (!url) continue;
    return {
      status: isVerifiedStatus(candidate.urlStatus) ? "verified" : "unverified",
      url,
      sourceId: candidate.id,
    };
  }

  if (fallbackWebsite) {
    return { status: "unverified", url: fallbackWebsite, sourceId: null };
  }

  return { status: "unavailable", url: null, sourceId: null };
}
