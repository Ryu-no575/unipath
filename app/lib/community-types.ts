import type { CommunityPostType, StudentStatus } from "@/app/lib/supabase/database.types";

/** Shared between server data/actions and client form components -- no
 * "server-only" import here, unlike app/lib/data/community.ts. */

export const COMMUNITY_POST_TYPES: CommunityPostType[] = [
  "question",
  "discussion",
  "experience",
  "housing",
  "admissions",
  "visa",
  "portfolio",
  "campus",
  "city_life",
  "other",
];

export const STUDENT_STATUSES: StudentStatus[] = [
  "applicant",
  "admitted",
  "current_student",
  "alumni",
];

export interface CommunityProgramOption {
  id: string;
  name: string;
  degreeType: string | null;
}
