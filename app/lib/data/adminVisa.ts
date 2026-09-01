import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationType, Database, VisaItemKey, VisaRequirementStatus } from "@/app/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface AdminVisaProfileRow {
  id: string;
  nationalityCountry: string;
  destinationCountry: string;
  studyLevel: ApplicationType;
  status: VisaRequirementStatus;
  lastCheckedAt: string | null;
  itemCount: number;
  sourceCount: number;
  activeJourneyCount: number;
}

/** /admin/visa list -- every curated (nationality, destination, study level)
 * combination, its verification status, and how much content/tracking
 * exists for it. */
export async function listVisaProfiles(supabase: Client): Promise<AdminVisaProfileRow[]> {
  const { data: profiles } = await supabase
    .from("visa_requirement_profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!profiles || profiles.length === 0) return [];

  const profileIds = profiles.map((p) => p.id);
  const [{ data: items }, { data: sources }, { data: journeys }] = await Promise.all([
    supabase.from("visa_requirement_items").select("visa_profile_id").in("visa_profile_id", profileIds),
    supabase.from("sources").select("visa_profile_id").in("visa_profile_id", profileIds).eq("admin_rejected", false),
    supabase.from("user_visa_journeys").select("visa_profile_id").in("visa_profile_id", profileIds),
  ]);

  function countBy(rows: { visa_profile_id: string | null }[] | null): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.visa_profile_id) continue;
      map.set(row.visa_profile_id, (map.get(row.visa_profile_id) ?? 0) + 1);
    }
    return map;
  }

  const itemCounts = countBy(items);
  const sourceCounts = countBy(sources);
  const journeyCounts = countBy(journeys);

  return profiles.map((p) => ({
    id: p.id,
    nationalityCountry: p.nationality_country,
    destinationCountry: p.destination_country,
    studyLevel: p.study_level,
    status: p.status,
    lastCheckedAt: p.last_checked_at,
    itemCount: itemCounts.get(p.id) ?? 0,
    sourceCount: sourceCounts.get(p.id) ?? 0,
    activeJourneyCount: journeyCounts.get(p.id) ?? 0,
  }));
}

export interface AdminVisaItemRow {
  id: string;
  itemKey: VisaItemKey;
  title: string | null;
  description: string | null;
  required: boolean;
  orderIndex: number;
  sourceId: string | null;
}

export interface AdminVisaSourceRow {
  id: string;
  url: string | null;
  urlStatus: Database["public"]["Tables"]["sources"]["Row"]["url_status"];
  lastCheckedAt: string | null;
  adminRejected: boolean;
}

export interface AdminVisaProfileDetail {
  id: string;
  nationalityCountry: string;
  destinationCountry: string;
  studyLevel: ApplicationType;
  visaType: string | null;
  summary: string | null;
  status: VisaRequirementStatus;
  lastCheckedAt: string | null;
  items: AdminVisaItemRow[];
  sources: AdminVisaSourceRow[];
}

export async function getAdminVisaProfileDetail(supabase: Client, id: string): Promise<AdminVisaProfileDetail | null> {
  const { data: profile } = await supabase.from("visa_requirement_profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return null;

  const [{ data: items }, { data: sources }] = await Promise.all([
    supabase.from("visa_requirement_items").select("*").eq("visa_profile_id", id).order("order_index", { ascending: true }),
    supabase.from("sources").select("*").eq("visa_profile_id", id).order("created_at", { ascending: false }),
  ]);

  return {
    id: profile.id,
    nationalityCountry: profile.nationality_country,
    destinationCountry: profile.destination_country,
    studyLevel: profile.study_level,
    visaType: profile.visa_type,
    summary: profile.summary,
    status: profile.status,
    lastCheckedAt: profile.last_checked_at,
    items: (items ?? []).map((i) => ({
      id: i.id,
      itemKey: i.item_key,
      title: i.title,
      description: i.description,
      required: i.required,
      orderIndex: i.order_index,
      sourceId: i.source_id,
    })),
    sources: (sources ?? []).map((s) => ({
      id: s.id,
      url: s.resolved_url ?? s.official_url,
      urlStatus: s.url_status,
      lastCheckedAt: s.last_checked_at,
      adminRejected: s.admin_rejected,
    })),
  };
}
