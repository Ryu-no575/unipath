import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityReportStatus, Database } from "@/app/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface AdminCommunityReportRow {
  id: string;
  reporterUserId: string;
  reporterDisplayName: string;
  reason: string;
  details: string | null;
  status: CommunityReportStatus;
  createdAt: string;
  contentType: "post" | "comment";
  contentExcerpt: string;
  contentHref: string | null;
}

function excerpt(text: string, max = 160): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** Moderation queue for /admin/community (task brief item 21). Never reads
 * `profiles` (GPA, budget, nationality, ...) or passport/document tables --
 * only `community_profiles` (already public) and the reported content
 * itself, matching the task brief's explicit "Private Passport / Grades /
 * Documents を無条件表示しない" constraint. */
export async function listAdminCommunityReports(supabase: Client): Promise<AdminCommunityReportRow[]> {
  const { data: reports } = await supabase
    .from("community_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (!reports || reports.length === 0) return [];

  const reporterIds = [...new Set(reports.map((r) => r.reporter_user_id))];
  const postIds = [...new Set(reports.map((r) => r.post_id).filter((id): id is string => Boolean(id)))];
  const commentIds = [...new Set(reports.map((r) => r.comment_id).filter((id): id is string => Boolean(id)))];

  const [{ data: reporters }, { data: posts }, { data: comments }] = await Promise.all([
    reporterIds.length > 0
      ? supabase.from("community_profiles").select("user_id, display_name").in("user_id", reporterIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
    postIds.length > 0
      ? supabase.from("community_posts").select("id, title, body, university_id").in("id", postIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null; body: string; university_id: string }[] }),
    commentIds.length > 0
      ? supabase.from("community_comments").select("id, body, post_id").in("id", commentIds)
      : Promise.resolve({ data: [] as { id: string; body: string; post_id: string }[] }),
  ]);

  const reporterNameById = new Map((reporters ?? []).map((r) => [r.user_id, r.display_name]));
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const commentById = new Map((comments ?? []).map((c) => [c.id, c]));

  return reports.map((r): AdminCommunityReportRow => {
    const displayName = reporterNameById.get(r.reporter_user_id);
    const reporterDisplayName = displayName?.trim() ? displayName : `Student ${r.reporter_user_id.slice(0, 6).toUpperCase()}`;

    if (r.comment_id) {
      const comment = commentById.get(r.comment_id);
      return {
        id: r.id,
        reporterUserId: r.reporter_user_id,
        reporterDisplayName,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        contentType: "comment",
        contentExcerpt: comment ? excerpt(comment.body) : "(comment deleted)",
        contentHref: comment ? `/community/post/${comment.post_id}` : null,
      };
    }

    const post = r.post_id ? postById.get(r.post_id) : undefined;
    return {
      id: r.id,
      reporterUserId: r.reporter_user_id,
      reporterDisplayName,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      contentType: "post",
      contentExcerpt: post ? (post.title ? `${post.title} — ${excerpt(post.body, 100)}` : excerpt(post.body)) : "(post deleted)",
      contentHref: post ? `/universities/${post.university_id}/community/${post.id}` : null,
    };
  });
}

export interface RequestedUniversityRow {
  id: string;
  universityName: string;
  countryCode: string | null;
  officialWebsite: string | null;
  requestedByUserId: string;
  createdAt: string;
}

/**
 * "Requested Universities" (task brief item 24) -- deliberately reuses
 * `user_custom_universities` (see 20260826180000_canonical_university_model.sql)
 * instead of a new `data_requests` table: a user already gets exactly this
 * "this university isn't in the catalog yet" flow today when adding an
 * application, so a second, parallel request mechanism would just fork the
 * same intent into two places an admin has to check.
 */
export async function listRequestedUniversities(supabase: Client, limit = 50): Promise<RequestedUniversityRow[]> {
  const { data } = await supabase
    .from("user_custom_universities")
    .select("id, university_name, country_code, official_website, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    universityName: row.university_name,
    countryCode: row.country_code,
    officialWebsite: row.official_website,
    requestedByUserId: row.user_id,
    createdAt: row.created_at,
  }));
}
