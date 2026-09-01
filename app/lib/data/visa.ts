import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplicationType,
  Database,
  UserVisaJourneyStatus,
  VisaItemKey,
  VisaRequirementStatus,
} from "@/app/lib/supabase/database.types";
import type { ApplicationWithDetails } from "./applications";

type Client = SupabaseClient<Database>;

/**
 * Which of the user's applications can have a Visa Journey -- only an
 * accepted offer at a real (catalog) university, since a visa is issued
 * against a real destination country and a confirmed place of study
 * (AGENTS.md section 3/12's "Received Offer -> Start Visa preparation").
 * Custom (non-catalog) universities have no verified country_code, so they
 * never qualify -- there is nothing to check a visa requirement against.
 */
export function visaEligibleApplications(applications: ApplicationWithDetails[]): ApplicationWithDetails[] {
  return applications.filter((a) => a.status === "accepted" && Boolean(a.university?.countryCode));
}

export interface VisaJourneySummary {
  id: string;
  applicationId: string | null;
  status: UserVisaJourneyStatus;
  universityName: string | null;
  destinationCountry: string;
  nationalityCountry: string;
  studyLevel: ApplicationType;
  profileStatus: VisaRequirementStatus;
  completedItems: number;
  totalItems: number;
}

/** Every Visa Journey the user has already started (via startVisaJourneyAction) --
 * /plan/visa's index list. Does not include eligible-but-not-yet-started
 * applications; the page itself offers those as a separate "Start" CTA. */
export async function listUserVisaJourneys(supabase: Client, userId: string): Promise<VisaJourneySummary[]> {
  const { data: journeys } = await supabase
    .from("user_visa_journeys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (!journeys || journeys.length === 0) return [];

  const profileIds = Array.from(new Set(journeys.map((j) => j.visa_profile_id)));
  const applicationIds = Array.from(
    new Set(journeys.map((j) => j.application_id).filter((id): id is string => Boolean(id))),
  );

  const [{ data: profiles }, { data: applications }] = await Promise.all([
    supabase.from("visa_requirement_profiles").select("*").in("id", profileIds),
    applicationIds.length > 0
      ? supabase.from("applications").select("id, program_id, custom_university_id").in("id", applicationIds)
      : Promise.resolve({ data: [] as { id: string; program_id: string | null; custom_university_id: string | null }[] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const programIds = Array.from(
    new Set((applications ?? []).map((a) => a.program_id).filter((id): id is string => Boolean(id))),
  );
  const { data: programs } =
    programIds.length > 0
      ? await supabase.from("programs").select("id, university_id").in("id", programIds)
      : { data: [] as { id: string; university_id: string }[] };
  const universityIdByProgramId = new Map((programs ?? []).map((p) => [p.id, p.university_id]));

  const universityIds = Array.from(new Set(Array.from(universityIdByProgramId.values())));
  const { data: universities } =
    universityIds.length > 0
      ? await supabase.from("universities").select("id, official_name").in("id", universityIds)
      : { data: [] as { id: string; official_name: string }[] };
  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));
  const applicationById = new Map((applications ?? []).map((a) => [a.id, a]));

  const itemCounts = await getChecklistCompletionByJourney(
    supabase,
    journeys.map((j) => j.id),
  );

  return journeys.map((j): VisaJourneySummary => {
    const profile = profileById.get(j.visa_profile_id);
    const application = j.application_id ? applicationById.get(j.application_id) : null;
    const universityId = application?.program_id ? universityIdByProgramId.get(application.program_id) : null;
    const counts = itemCounts.get(j.id) ?? { completed: 0, total: 0 };
    return {
      id: j.id,
      applicationId: j.application_id,
      status: j.status,
      universityName: universityId ? (universityNameById.get(universityId) ?? null) : null,
      destinationCountry: profile?.destination_country ?? "",
      nationalityCountry: profile?.nationality_country ?? "",
      studyLevel: profile?.study_level ?? "bachelor",
      profileStatus: profile?.status ?? "being_verified",
      completedItems: counts.completed,
      totalItems: counts.total,
    };
  });
}

async function getChecklistCompletionByJourney(
  supabase: Client,
  journeyIds: string[],
): Promise<Map<string, { completed: number; total: number }>> {
  const result = new Map<string, { completed: number; total: number }>();
  if (journeyIds.length === 0) return result;

  const { data: journeys } = await supabase
    .from("user_visa_journeys")
    .select("id, visa_profile_id")
    .in("id", journeyIds);
  const profileIdByJourneyId = new Map((journeys ?? []).map((j) => [j.id, j.visa_profile_id]));
  const profileIds = Array.from(new Set(Array.from(profileIdByJourneyId.values())));

  const { data: items } =
    profileIds.length > 0
      ? await supabase.from("visa_requirement_items").select("id, visa_profile_id").in("visa_profile_id", profileIds)
      : { data: [] as { id: string; visa_profile_id: string }[] };
  const itemsByProfileId = new Map<string, string[]>();
  for (const item of items ?? []) {
    const list = itemsByProfileId.get(item.visa_profile_id) ?? [];
    list.push(item.id);
    itemsByProfileId.set(item.visa_profile_id, list);
  }

  const { data: progress } = await supabase
    .from("user_visa_checklist_progress")
    .select("user_visa_journey_id, completed")
    .in("user_visa_journey_id", journeyIds)
    .eq("completed", true);
  const completedByJourneyId = new Map<string, number>();
  for (const p of progress ?? []) {
    completedByJourneyId.set(p.user_visa_journey_id, (completedByJourneyId.get(p.user_visa_journey_id) ?? 0) + 1);
  }

  for (const journeyId of journeyIds) {
    const profileId = profileIdByJourneyId.get(journeyId);
    const total = profileId ? (itemsByProfileId.get(profileId)?.length ?? 0) : 0;
    result.set(journeyId, { completed: completedByJourneyId.get(journeyId) ?? 0, total });
  }
  return result;
}

export interface VisaChecklistItemView {
  id: string;
  itemKey: VisaItemKey;
  title: string | null;
  description: string | null;
  required: boolean;
  completed: boolean;
  sourceUrl: string | null;
  sourceLastCheckedAt: string | null;
}

export interface VisaSourceView {
  id: string;
  url: string | null;
  urlStatus: Database["public"]["Tables"]["sources"]["Row"]["url_status"];
  lastCheckedAt: string | null;
}

export interface VisaJourneyDetail {
  id: string;
  userId: string;
  applicationId: string | null;
  status: UserVisaJourneyStatus;
  nationalityCountry: string;
  destinationCountry: string;
  studyLevel: ApplicationType;
  visaType: string | null;
  summary: string | null;
  profileStatus: VisaRequirementStatus;
  lastCheckedAt: string | null;
  items: VisaChecklistItemView[];
  sources: VisaSourceView[];
}

/** Full detail for /plan/visa/[journeyId] -- checklist + official sources.
 * Returns null when the journey doesn't exist or doesn't belong to userId
 * (RLS would already block the row for another user's client, but this data
 * layer is also called with an admin client in some paths, so the check is
 * explicit here too). */
export async function getVisaJourneyDetail(
  supabase: Client,
  userId: string,
  journeyId: string,
): Promise<VisaJourneyDetail | null> {
  const { data: journey } = await supabase.from("user_visa_journeys").select("*").eq("id", journeyId).maybeSingle();
  if (!journey || journey.user_id !== userId) return null;

  const { data: profile } = await supabase
    .from("visa_requirement_profiles")
    .select("*")
    .eq("id", journey.visa_profile_id)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: items }, { data: progress }, { data: sources }] = await Promise.all([
    supabase
      .from("visa_requirement_items")
      .select("*")
      .eq("visa_profile_id", profile.id)
      .order("order_index", { ascending: true }),
    supabase.from("user_visa_checklist_progress").select("*").eq("user_visa_journey_id", journey.id),
    supabase.from("sources").select("*").eq("visa_profile_id", profile.id).eq("admin_rejected", false),
  ]);

  const completedItemIds = new Set((progress ?? []).filter((p) => p.completed).map((p) => p.visa_item_id));
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));

  return {
    id: journey.id,
    userId: journey.user_id,
    applicationId: journey.application_id,
    status: journey.status,
    nationalityCountry: profile.nationality_country,
    destinationCountry: profile.destination_country,
    studyLevel: profile.study_level,
    visaType: profile.visa_type,
    summary: profile.summary,
    profileStatus: profile.status,
    lastCheckedAt: profile.last_checked_at,
    items: (items ?? []).map((item) => {
      const source = item.source_id ? sourceById.get(item.source_id) : undefined;
      return {
        id: item.id,
        itemKey: item.item_key,
        title: item.title,
        description: item.description,
        required: item.required,
        completed: completedItemIds.has(item.id),
        sourceUrl: source ? (source.resolved_url ?? source.official_url) : null,
        sourceLastCheckedAt: source?.last_checked_at ?? null,
      };
    }),
    sources: (sources ?? []).map((s) => ({
      id: s.id,
      url: s.resolved_url ?? s.official_url,
      urlStatus: s.url_status,
      lastCheckedAt: s.last_checked_at,
    })),
  };
}
