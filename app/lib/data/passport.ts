import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";
import type { ApplicationWithDetails } from "./applications";
import {
  computeApplicationReadiness,
  type ApplicationReadiness,
  type ReadinessItem,
} from "@/app/lib/passport/readiness";
import { syncMissingRequirementTasks } from "@/app/lib/passport/tasks";

type Client = SupabaseClient<Database>;
type EducationHistoryRow = Database["public"]["Tables"]["education_history"]["Row"];
type TestScoreRow = Database["public"]["Tables"]["test_scores"]["Row"];
type ApplicationDocumentRow = Database["public"]["Tables"]["application_documents"]["Row"];
type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function getEducationHistory(
  supabase: Client,
  userId: string,
): Promise<EducationHistoryRow[]> {
  const { data } = await supabase
    .from("education_history")
    .select("*")
    .eq("user_id", userId)
    .order("end_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getTestScores(supabase: Client, userId: string): Promise<TestScoreRow[]> {
  const { data } = await supabase
    .from("test_scores")
    .select("*")
    .eq("user_id", userId)
    .order("test_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getApplicationDocuments(
  supabase: Client,
  userId: string,
): Promise<ApplicationDocumentRow[]> {
  const { data } = await supabase
    .from("application_documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface DocumentLink {
  documentId: string;
  applicationId: string;
}

/** application_document_links carries no user_id column -- RLS already
 * restricts every visible row to links where both the application and the
 * document belong to the caller (see the migration), so a plain unscoped
 * select is both safe and complete for "this user's" links. */
export async function getDocumentLinksForUser(supabase: Client): Promise<DocumentLink[]> {
  const { data } = await supabase.from("application_document_links").select("document_id, application_id");
  return (data ?? []).map((l) => ({ documentId: l.document_id, applicationId: l.application_id }));
}

export async function getAdmissionRequirementsForCycle(
  supabase: Client,
  admissionCycleId: string,
): Promise<AdmissionRequirementRow[]> {
  const { data } = await supabase
    .from("admission_requirements")
    .select("*")
    .eq("admission_cycle_id", admissionCycleId);
  return data ?? [];
}

export interface ApplicationReadinessResult extends ApplicationReadiness {
  applicationId: string;
}

/** Computes Readiness for one application. Custom-university applications
 * (no official catalog entry, see user_custom_universities) and applications
 * whose admission cycle has zero requirement rows both surface as "limited"
 * -- there is no official requirement data to check against, never a
 * fabricated one. */
export async function getApplicationReadiness(
  supabase: Client,
  params: {
    application: Pick<ApplicationWithDetails, "id" | "isCustomUniversity" | "admissionCycle">;
    documents: ApplicationDocumentRow[];
    testScores: TestScoreRow[];
    linkedDocumentIds: Set<string>;
    profile: Pick<ProfileRow, "english_test_type" | "english_test_score"> | null;
  },
): Promise<ApplicationReadinessResult> {
  if (params.application.isCustomUniversity || !params.application.admissionCycle) {
    return {
      applicationId: params.application.id,
      status: "limited",
      scorePercent: null,
      readyCount: 0,
      trackableCount: 0,
      items: [],
    };
  }

  const requirements = await getAdmissionRequirementsForCycle(supabase, params.application.admissionCycle.id);

  const readiness = computeApplicationReadiness({
    requirements,
    documents: params.documents,
    testScores: params.testScores,
    linkedDocumentIds: params.linkedDocumentIds,
    profile: params.profile,
  });

  return { applicationId: params.application.id, ...readiness };
}

/** Readiness for every one of a user's applications in one pass -- used on
 * the Passport hub. Reuses one fetch of documents/test scores/links across
 * all applications instead of re-querying per card. */
export async function getReadinessForApplications(
  supabase: Client,
  params: {
    applications: ApplicationWithDetails[];
    documents: ApplicationDocumentRow[];
    testScores: TestScoreRow[];
    links: DocumentLink[];
    profile: Pick<ProfileRow, "english_test_type" | "english_test_score"> | null;
  },
): Promise<ApplicationReadinessResult[]> {
  const results = await Promise.all(
    params.applications.map((application) => {
      const linkedDocumentIds = new Set(
        params.links.filter((l) => l.applicationId === application.id).map((l) => l.documentId),
      );
      return getApplicationReadiness(supabase, {
        application,
        documents: params.documents,
        testScores: params.testScores,
        linkedDocumentIds,
        profile: params.profile,
      });
    }),
  );
  return results;
}

/** Runs syncMissingRequirementTasks (see app/lib/passport/tasks.ts) for
 * every application that has computed Readiness, so Dashboard's Next Action
 * / Calendar / Applications views all pick up newly-missing requirements
 * without any changes to their own task-reading logic. */
export async function syncReadinessTasksForApplications(
  supabase: Client,
  params: {
    userId: string;
    applications: ApplicationWithDetails[];
    documents: ApplicationDocumentRow[];
    testScores: TestScoreRow[];
    links: DocumentLink[];
    profile: Pick<ProfileRow, "english_test_type" | "english_test_score"> | null;
    fallbackTimezone: string;
    titleFor: (item: ReadinessItem) => string;
  },
): Promise<void> {
  const readinessList = await getReadinessForApplications(supabase, params);
  const applicationById = new Map(params.applications.map((a) => [a.id, a]));

  await Promise.all(
    readinessList.map((readiness) => {
      if (readiness.status !== "computed") return Promise.resolve();
      const application = applicationById.get(readiness.applicationId);
      if (!application) return Promise.resolve();
      return syncMissingRequirementTasks(supabase, {
        userId: params.userId,
        applicationId: application.id,
        missingItems: readiness.items,
        officialDeadline: application.admissionCycle?.applicationDeadline ?? null,
        timezone: application.admissionCycle?.deadlineTimezone ?? params.fallbackTimezone,
        titleFor: params.titleFor,
      });
    }),
  );
}
