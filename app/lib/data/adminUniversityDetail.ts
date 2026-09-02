import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SourceUrlStatus } from "@/app/lib/supabase/database.types";
import { isHardBroken, isVerifiedStatus } from "@/app/lib/live-data/sourceStatus";
import { classifyInstitutionNamePattern } from "@/app/lib/importers/ror";
import {
  computeUniversityConfidence,
  computeUniversityDataStatus,
  computeUniversityReviewReasons,
  type DataStatus,
  type VerificationConfidence,
} from "./dataStatus";

type Client = SupabaseClient<Database>;

export interface AdminUniversitySourceDetail {
  id: string;
  officialUrl: string | null;
  resolvedUrl: string | null;
  urlStatus: SourceUrlStatus;
  httpStatus: number | null;
  validationError: string | null;
  lastCheckedAt: string | null;
  lastValidatedAt: string | null;
  lastSuccessfulCheckAt: string | null;
  adminRejected: boolean;
  adminRejectedAt: string | null;
}

export interface AdminUniversityDetail {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  officialWebsite: string | null;
  rorId: string | null;
  rorSourceUrl: string | null;
  dataSource: string | null;
  officialWebsiteSource: AdminUniversitySourceDetail | null;
  dataStatus: DataStatus;
  confidence: VerificationConfidence;
  reviewReasons: string[];
  institutionNamePattern: "qualifies" | "disqualifies" | "ambiguous";
  updatedAt: string;
  studentStats: {
    totalStudents: number | null;
    internationalStudents: number | null;
    internationalStudentPercentage: number | null;
    academicYear: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    lastVerifiedAt: string | null;
  };
}

export async function getAdminUniversityDetail(supabase: Client, universityId: string): Promise<AdminUniversityDetail | null> {
  const { data: university } = await supabase
    .from("universities")
    .select(
      "id, official_name, country_code, city, official_website, ror_id, data_source, updated_at, total_students, international_students, international_student_percentage, student_stats_academic_year, student_stats_source_name, student_stats_source_url, student_stats_last_verified_at",
    )
    .eq("id", universityId)
    .maybeSingle();
  if (!university) return null;

  const { data: sources } = await supabase
    .from("sources")
    .select(
      "id, source_type, official_url, resolved_url, url_status, http_status, validation_error, last_checked_at, last_validated_at, last_successful_check_at, admin_rejected, admin_rejected_at",
    )
    .eq("university_id", universityId)
    .eq("page_type", "university");

  const rorSource = (sources ?? []).find((s) => s.source_type === "ror") ?? null;
  const websiteSource = (sources ?? []).find((s) => s.source_type === "official_website") ?? null;

  const hasVerifiedSource = Boolean(websiteSource && !websiteSource.admin_rejected && isVerifiedStatus(websiteSource.url_status));
  const hasAnySource = Boolean(websiteSource);
  const hasUncheckedSource = Boolean(websiteSource && websiteSource.url_status === "unknown");
  const isHardBrokenSource = Boolean(websiteSource && (websiteSource.admin_rejected || isHardBroken(websiteSource.url_status)));

  const dataStatus = computeUniversityDataStatus({
    dataSource: university.data_source,
    hasVerifiedSource,
    hasAnySource,
  });
  const namePattern = classifyInstitutionNamePattern(university.official_name);

  return {
    id: university.id,
    name: university.official_name,
    countryCode: university.country_code,
    city: university.city,
    officialWebsite: university.official_website,
    rorId: university.ror_id,
    rorSourceUrl: rorSource?.official_url ?? null,
    dataSource: university.data_source,
    officialWebsiteSource: websiteSource
      ? {
          id: websiteSource.id,
          officialUrl: websiteSource.official_url,
          resolvedUrl: websiteSource.resolved_url,
          urlStatus: websiteSource.url_status,
          httpStatus: websiteSource.http_status,
          validationError: websiteSource.validation_error,
          lastCheckedAt: websiteSource.last_checked_at,
          lastValidatedAt: websiteSource.last_validated_at,
          lastSuccessfulCheckAt: websiteSource.last_successful_check_at,
          adminRejected: websiteSource.admin_rejected,
          adminRejectedAt: websiteSource.admin_rejected_at,
        }
      : null,
    dataStatus,
    confidence: computeUniversityConfidence({
      hasStableIdentifier: Boolean(university.ror_id),
      hasVerifiedSource,
      namePattern,
      isDuplicateCandidate: false,
    }),
    reviewReasons: computeUniversityReviewReasons({
      dataStatus,
      hasStableIdentifier: Boolean(university.ror_id),
      hasOfficialWebsite: Boolean(university.official_website),
      hasAnySource,
      hasUncheckedSource,
      hardBrokenStatus: isHardBrokenSource ? websiteSource!.url_status : null,
      namePattern,
      isDuplicateCandidate: false,
      duplicateOfName: null,
    }),
    institutionNamePattern: namePattern,
    updatedAt: university.updated_at,
    studentStats: {
      totalStudents: university.total_students,
      internationalStudents: university.international_students,
      internationalStudentPercentage: university.international_student_percentage,
      academicYear: university.student_stats_academic_year,
      sourceName: university.student_stats_source_name,
      sourceUrl: university.student_stats_source_url,
      lastVerifiedAt: university.student_stats_last_verified_at,
    },
  };
}
