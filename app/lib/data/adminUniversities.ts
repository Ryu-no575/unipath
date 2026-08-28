import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import { isHardBroken, isVerifiedStatus } from "@/app/lib/live-data/sourceStatus";
import { getRegistrableDomain } from "@/app/lib/live-data/domain";
import { classifyInstitutionNamePattern } from "@/app/lib/importers/ror";
import {
  computeUniversityConfidence,
  computeUniversityDataStatus,
  computeUniversityReviewReasons,
  type DataStatus,
  type VerificationConfidence,
} from "./dataStatus";

type Client = SupabaseClient<Database>;

export interface AdminUniversityRow {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  officialWebsite: string | null;
  rorId: string | null;
  dataSource: string | null;
  programCount: number;
  verifiedProgramCount: number;
  sourceCount: number;
  healthySourceCount: number;
  brokenSourceCount: number;
  dataStatus: DataStatus;
  confidence: VerificationConfidence;
  reviewReasons: string[];
  isBrokenSource: boolean;
  isNoOfficialSource: boolean;
  isDuplicateCandidate: boolean;
  duplicateOfName: string | null;
  updatedAt: string;
}

/** Loose, non-destructive duplicate-candidate detector (task: "大学名だけで
 * duplicate判定しないでください。優先: ROR ID -> stable identifier -> official domain
 * -> normalized name + country"). ror_id already has a DB-level unique
 * constraint (see 20260825120000_core_schema.sql), so two rows can never
 * share one -- any remaining duplicate risk is two *different* identifiers
 * (or one missing) pointing at what's actually the same institution, which
 * this only flags for a human to confirm; nothing is ever auto-merged or
 * deleted here. */
function normalizeUniversityName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|of|and|de|la|le|der|die|das|università|universita|universidad|universidade|university|universite)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findDuplicateCandidates(
  universities: { id: string; official_name: string; country_code: string | null; official_website: string | null }[],
): Map<string, string> {
  const duplicateOfById = new Map<string, string>();

  const byNameCountry = new Map<string, { id: string; name: string }[]>();
  const byDomain = new Map<string, { id: string; name: string }[]>();

  for (const u of universities) {
    const nameKey = `${normalizeUniversityName(u.official_name)}|${u.country_code ?? ""}`;
    if (nameKey.trim().length > 1) {
      const bucket = byNameCountry.get(nameKey) ?? [];
      bucket.push({ id: u.id, name: u.official_name });
      byNameCountry.set(nameKey, bucket);
    }

    if (u.official_website) {
      try {
        const domain = getRegistrableDomain(new URL(u.official_website).hostname);
        const bucket = byDomain.get(domain) ?? [];
        bucket.push({ id: u.id, name: u.official_name });
        byDomain.set(domain, bucket);
      } catch {
        // malformed official_website -- ignore for domain-based grouping.
      }
    }
  }

  for (const bucket of [...byNameCountry.values(), ...byDomain.values()]) {
    if (bucket.length < 2) continue;
    for (const entry of bucket) {
      if (duplicateOfById.has(entry.id)) continue;
      const other = bucket.find((b) => b.id !== entry.id);
      if (other) duplicateOfById.set(entry.id, other.name);
    }
  }

  return duplicateOfById;
}

/**
 * Full university roster for /admin/universities (task brief item 10).
 * Bounded by this catalog's real-world size (a few hundred rows even at
 * `npm run sync:universities`'s full target -- see
 * scripts/import-universities.ts), so this loads everything and lets the
 * page filter/sort in memory rather than pushing filters into SQL.
 */
export async function listAdminUniversities(supabase: Client): Promise<AdminUniversityRow[]> {
  const [{ data: universities }, { data: programs }, { data: sources }] = await Promise.all([
    supabase.from("universities").select("id, official_name, country_code, city, official_website, ror_id, data_source, updated_at"),
    supabase.from("programs").select("id, university_id, verified_at"),
    supabase
      .from("sources")
      .select("university_id, program_id, url_status, admin_rejected")
      .neq("source_type", "ror"),
  ]);
  if (!universities) return [];

  const universityIdByProgramId = new Map((programs ?? []).map((p) => [p.id, p.university_id]));
  const programsByUniversity = new Map<string, { total: number; verified: number }>();
  for (const p of programs ?? []) {
    const bucket = programsByUniversity.get(p.university_id) ?? { total: 0, verified: 0 };
    bucket.total += 1;
    if (p.verified_at) bucket.verified += 1;
    programsByUniversity.set(p.university_id, bucket);
  }

  const sourcesByUniversity = new Map<
    string,
    { total: number; healthy: number; broken: number; unchecked: number; hardBrokenStatus: string | null }
  >();
  for (const s of sources ?? []) {
    const universityId = s.university_id ?? (s.program_id ? universityIdByProgramId.get(s.program_id) : null);
    if (!universityId) continue;
    const bucket = sourcesByUniversity.get(universityId) ?? { total: 0, healthy: 0, broken: 0, unchecked: 0, hardBrokenStatus: null };
    bucket.total += 1;
    const verified = !s.admin_rejected && isVerifiedStatus(s.url_status);
    const hardBroken = s.admin_rejected || isHardBroken(s.url_status);
    if (verified) bucket.healthy += 1;
    else if (hardBroken) {
      bucket.broken += 1;
      bucket.hardBrokenStatus = bucket.hardBrokenStatus ?? s.url_status;
    } else if (s.url_status === "unknown") bucket.unchecked += 1;
    sourcesByUniversity.set(universityId, bucket);
  }

  const duplicateOfById = findDuplicateCandidates(
    universities.map((u) => ({ id: u.id, official_name: u.official_name, country_code: u.country_code, official_website: u.official_website })),
  );

  return universities
    .map((u): AdminUniversityRow => {
      const programBucket = programsByUniversity.get(u.id) ?? { total: 0, verified: 0 };
      const sourceBucket = sourcesByUniversity.get(u.id) ?? { total: 0, healthy: 0, broken: 0, unchecked: 0, hardBrokenStatus: null };
      const hasVerifiedSource = sourceBucket.healthy > 0;
      const hasAnySource = sourceBucket.total > 0;
      const dataStatus = computeUniversityDataStatus({
        dataSource: u.data_source,
        hasVerifiedSource,
        hasAnySource,
      });
      const namePattern = classifyInstitutionNamePattern(u.official_name);
      const duplicateOfName = duplicateOfById.get(u.id) ?? null;
      const isDuplicateCandidate = duplicateOfName !== null;

      return {
        id: u.id,
        name: u.official_name,
        countryCode: u.country_code,
        city: u.city,
        officialWebsite: u.official_website,
        rorId: u.ror_id,
        dataSource: u.data_source,
        programCount: programBucket.total,
        verifiedProgramCount: programBucket.verified,
        sourceCount: sourceBucket.total,
        healthySourceCount: sourceBucket.healthy,
        brokenSourceCount: sourceBucket.broken,
        dataStatus,
        confidence: computeUniversityConfidence({
          hasStableIdentifier: Boolean(u.ror_id),
          hasVerifiedSource,
          namePattern,
          isDuplicateCandidate,
        }),
        reviewReasons: computeUniversityReviewReasons({
          dataStatus,
          hasStableIdentifier: Boolean(u.ror_id),
          hasOfficialWebsite: Boolean(u.official_website),
          hasAnySource,
          hasUncheckedSource: sourceBucket.unchecked > 0,
          hardBrokenStatus: sourceBucket.broken > 0 && sourceBucket.broken === sourceBucket.total ? sourceBucket.hardBrokenStatus : null,
          namePattern,
          isDuplicateCandidate,
          duplicateOfName,
        }),
        isBrokenSource: hasAnySource && sourceBucket.broken === sourceBucket.total,
        isNoOfficialSource: !u.official_website && !hasAnySource,
        isDuplicateCandidate,
        duplicateOfName,
        updatedAt: u.updated_at,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
