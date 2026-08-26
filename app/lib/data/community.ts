import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityPostType,
  Database,
  StudentStatus,
} from "@/app/lib/supabase/database.types";
import type { CommunityProgramOption } from "@/app/lib/community-types";

export { COMMUNITY_POST_TYPES, STUDENT_STATUSES } from "@/app/lib/community-types";
export type { CommunityProgramOption } from "@/app/lib/community-types";

type Client = SupabaseClient<Database>;
type CommunityProfileRow = Database["public"]["Tables"]["community_profiles"]["Row"];
type CommunityPostRow = Database["public"]["Tables"]["community_posts"]["Row"];
type CommunityCommentRow = Database["public"]["Tables"]["community_comments"]["Row"];

export interface CommunityAuthor {
  userId: string;
  displayName: string;
  studentStatus: StudentStatus | null;
  studentStatusVerified: boolean;
}

/** Never derived from email -- community_profiles.display_name is the only
 * source, and this placeholder (not the email) is shown when it's unset. */
function fallbackDisplayName(userId: string): string {
  return `Student ${userId.slice(0, 6).toUpperCase()}`;
}

function toAuthor(userId: string, profile: CommunityProfileRow | undefined): CommunityAuthor {
  const trimmed = profile?.display_name?.trim();
  return {
    userId,
    displayName: trimmed ? trimmed : fallbackDisplayName(userId),
    studentStatus: profile?.student_status ?? null,
    studentStatusVerified: profile?.student_status_verified ?? false,
  };
}

async function fetchAuthors(
  supabase: Client,
  userIds: string[],
): Promise<Map<string, CommunityProfileRow>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data } = await supabase.from("community_profiles").select("*").in("user_id", uniqueIds);
  return new Map((data ?? []).map((row) => [row.user_id, row]));
}

export interface CommunityUniversitySummary {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  officialWebsite: string | null;
  foundedYear: number | null;
}

export async function getUniversityForCommunity(
  supabase: Client,
  universityId: string,
): Promise<CommunityUniversitySummary | null> {
  const { data } = await supabase
    .from("universities")
    .select("id, official_name, country_code, city, official_website, founded_year")
    .eq("id", universityId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.official_name,
    countryCode: data.country_code,
    city: data.city,
    officialWebsite: data.official_website,
    foundedYear: data.founded_year,
  };
}

export async function listProgramsForUniversity(
  supabase: Client,
  universityId: string,
): Promise<CommunityProgramOption[]> {
  const { data } = await supabase
    .from("programs")
    .select("id, official_name, degree_type")
    .eq("university_id", universityId)
    .order("official_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.official_name, degreeType: p.degree_type }));
}

/** Real, non-fabricated member counts -- distinct posters in this
 * university's community, grouped by their self-reported status. Zero stays
 * zero; there is no synthetic floor. See AGENTS.md section 18. */
export async function getCommunityMemberCounts(
  supabase: Client,
  universityId: string,
): Promise<Record<StudentStatus, number>> {
  const counts: Record<StudentStatus, number> = {
    applicant: 0,
    admitted: 0,
    current_student: 0,
    alumni: 0,
  };

  const { data: posts } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("university_id", universityId)
    .is("deleted_at", null);
  const posterIds = [...new Set((posts ?? []).map((p) => p.user_id))];
  if (posterIds.length === 0) return counts;

  const { data: profiles } = await supabase
    .from("community_profiles")
    .select("user_id, student_status")
    .in("user_id", posterIds);

  for (const profile of profiles ?? []) {
    if (profile.student_status) counts[profile.student_status] += 1;
  }
  return counts;
}

export interface CommunityPostSummary {
  id: string;
  postType: CommunityPostType;
  title: string | null;
  body: string;
  createdAt: string;
  author: CommunityAuthor;
  programName: string | null;
  intakeLabel: string | null;
  commentCount: number;
  likeCount: number;
  likedByViewer: boolean;
}

async function attachEngagement(
  supabase: Client,
  posts: CommunityPostRow[],
  viewerUserId: string | null,
): Promise<Map<string, { commentCount: number; likeCount: number; likedByViewer: boolean }>> {
  const postIds = posts.map((p) => p.id);
  const result = new Map<string, { commentCount: number; likeCount: number; likedByViewer: boolean }>();
  if (postIds.length === 0) return result;

  const [{ data: comments }, { data: likes }] = await Promise.all([
    supabase.from("community_comments").select("post_id").in("post_id", postIds).is("deleted_at", null),
    supabase.from("community_post_likes").select("post_id, user_id").in("post_id", postIds),
  ]);

  for (const id of postIds) result.set(id, { commentCount: 0, likeCount: 0, likedByViewer: false });
  for (const c of comments ?? []) {
    const entry = result.get(c.post_id);
    if (entry) entry.commentCount += 1;
  }
  for (const l of likes ?? []) {
    const entry = result.get(l.post_id);
    if (!entry) continue;
    entry.likeCount += 1;
    if (viewerUserId && l.user_id === viewerUserId) entry.likedByViewer = true;
  }
  return result;
}

async function attachProgramLabels(
  supabase: Client,
  posts: CommunityPostRow[],
): Promise<Map<string, { programName: string | null; intakeLabel: string | null }>> {
  const result = new Map<string, { programName: string | null; intakeLabel: string | null }>();
  const programIds = [...new Set(posts.map((p) => p.program_id).filter((id): id is string => Boolean(id)))];
  const cycleIds = [...new Set(posts.map((p) => p.admission_cycle_id).filter((id): id is string => Boolean(id)))];

  const [{ data: programs }, { data: cycles }] = await Promise.all([
    programIds.length > 0
      ? supabase.from("programs").select("id, official_name").in("id", programIds)
      : Promise.resolve({ data: [] as { id: string; official_name: string }[] }),
    cycleIds.length > 0
      ? supabase.from("admission_cycles").select("id, intake_year, intake_season").in("id", cycleIds)
      : Promise.resolve({ data: [] as { id: string; intake_year: number; intake_season: string }[] }),
  ]);

  const programMap = new Map((programs ?? []).map((p) => [p.id, p.official_name]));
  const cycleMap = new Map((cycles ?? []).map((c) => [c.id, `${c.intake_season} ${c.intake_year}`]));

  for (const post of posts) {
    result.set(post.id, {
      programName: post.program_id ? (programMap.get(post.program_id) ?? null) : null,
      intakeLabel: post.admission_cycle_id ? (cycleMap.get(post.admission_cycle_id) ?? null) : null,
    });
  }
  return result;
}

export interface CommunityPostFilters {
  postType?: CommunityPostType;
  programId?: string;
  intakeYear?: number;
}

export async function listCommunityPosts(
  supabase: Client,
  universityId: string,
  filters: CommunityPostFilters,
  viewerUserId: string | null,
): Promise<CommunityPostSummary[]> {
  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("university_id", universityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.postType) query = query.eq("post_type", filters.postType);
  if (filters.programId) query = query.eq("program_id", filters.programId);

  const { data: posts } = await query;
  if (!posts || posts.length === 0) return [];

  let filtered = posts;
  if (filters.intakeYear) {
    const { data: cyclesForYear } = await supabase
      .from("admission_cycles")
      .select("id")
      .eq("intake_year", filters.intakeYear);
    const cycleIds = new Set((cyclesForYear ?? []).map((c) => c.id));
    filtered = posts.filter((p) => p.admission_cycle_id && cycleIds.has(p.admission_cycle_id));
  }

  const [authors, engagement, programLabels] = await Promise.all([
    fetchAuthors(supabase, filtered.map((p) => p.user_id)),
    attachEngagement(supabase, filtered, viewerUserId),
    attachProgramLabels(supabase, filtered),
  ]);

  return filtered.map((post) => {
    const eng = engagement.get(post.id) ?? { commentCount: 0, likeCount: 0, likedByViewer: false };
    const labels = programLabels.get(post.id) ?? { programName: null, intakeLabel: null };
    return {
      id: post.id,
      postType: post.post_type,
      title: post.title,
      body: post.body,
      createdAt: post.created_at,
      author: toAuthor(post.user_id, authors.get(post.user_id)),
      programName: labels.programName,
      intakeLabel: labels.intakeLabel,
      commentCount: eng.commentCount,
      likeCount: eng.likeCount,
      likedByViewer: eng.likedByViewer,
    };
  });
}

export interface CommunityPostDetail extends CommunityPostSummary {
  universityId: string;
  programId: string | null;
  admissionCycleId: string | null;
}

export async function getCommunityPost(
  supabase: Client,
  postId: string,
  viewerUserId: string | null,
): Promise<CommunityPostDetail | null> {
  const { data: post } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!post) return null;

  const [authors, engagement, programLabels] = await Promise.all([
    fetchAuthors(supabase, [post.user_id]),
    attachEngagement(supabase, [post], viewerUserId),
    attachProgramLabels(supabase, [post]),
  ]);

  const eng = engagement.get(post.id) ?? { commentCount: 0, likeCount: 0, likedByViewer: false };
  const labels = programLabels.get(post.id) ?? { programName: null, intakeLabel: null };

  return {
    id: post.id,
    postType: post.post_type,
    title: post.title,
    body: post.body,
    createdAt: post.created_at,
    author: toAuthor(post.user_id, authors.get(post.user_id)),
    programName: labels.programName,
    intakeLabel: labels.intakeLabel,
    commentCount: eng.commentCount,
    likeCount: eng.likeCount,
    likedByViewer: eng.likedByViewer,
    universityId: post.university_id,
    programId: post.program_id,
    admissionCycleId: post.admission_cycle_id,
  };
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  author: CommunityAuthor;
  replies: CommunityComment[];
}

/** Builds a 2-level tree (top-level comments + one level of replies) --
 * matches the DB's `parent_comment_id` design, which supports arbitrary
 * depth, but v1 only renders top-level + replies-to-top-level (see AGENTS.md
 * section 5: "v1では1〜2階層程度で十分です"). A reply-to-a-reply is folded
 * into its top-level ancestor's reply list rather than dropped. */
export async function listCommentsForPost(
  supabase: Client,
  postId: string,
): Promise<CommunityComment[]> {
  const { data: rows } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (!rows || rows.length === 0) return [];

  const authors = await fetchAuthors(supabase, rows.map((r) => r.user_id));

  function toComment(row: CommunityCommentRow): CommunityComment {
    return {
      id: row.id,
      postId: row.post_id,
      parentCommentId: row.parent_comment_id,
      body: row.body,
      createdAt: row.created_at,
      author: toAuthor(row.user_id, authors.get(row.user_id)),
      replies: [],
    };
  }

  const byId = new Map(rows.map((row) => [row.id, toComment(row)]));
  const topLevel: CommunityComment[] = [];

  for (const row of rows) {
    const comment = byId.get(row.id)!;
    if (!row.parent_comment_id) {
      topLevel.push(comment);
      continue;
    }
    // Walk up to the nearest ancestor that made it into `topLevel` (handles
    // a reply-to-a-reply by flattening it one level, per the doc comment
    // above), falling back to top-level if the parent was deleted.
    let ancestorId: string | null = row.parent_comment_id;
    let ancestor = ancestorId ? byId.get(ancestorId) : undefined;
    while (ancestor && ancestor.parentCommentId) {
      ancestorId = ancestor.parentCommentId;
      ancestor = ancestorId ? byId.get(ancestorId) : undefined;
    }
    if (ancestor) ancestor.replies.push(comment);
    else topLevel.push(comment);
  }

  return topLevel;
}

export interface CommunityUniversityCard {
  id: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  postCount: number;
}

async function buildUniversityCards(
  supabase: Client,
  universityIds: string[],
): Promise<CommunityUniversityCard[]> {
  if (universityIds.length === 0) return [];

  const [{ data: universities }, { data: posts }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, official_name, country_code, city")
      .in("id", universityIds),
    supabase
      .from("community_posts")
      .select("university_id")
      .in("university_id", universityIds)
      .is("deleted_at", null),
  ]);

  const counts = new Map<string, number>();
  for (const post of posts ?? []) counts.set(post.university_id, (counts.get(post.university_id) ?? 0) + 1);

  return (universities ?? []).map((u) => ({
    id: u.id,
    name: u.official_name,
    countryCode: u.country_code,
    city: u.city,
    postCount: counts.get(u.id) ?? 0,
  }));
}

/** Universities the viewer belongs to via a real (non-custom) application --
 * "their" communities. Custom universities (user_custom_universities) have no
 * row in `universities`, so `community_posts.university_id` can't reference
 * them and they're excluded here. */
export async function getUserCommunities(
  supabase: Client,
  userId: string,
): Promise<CommunityUniversityCard[]> {
  const { data: applications } = await supabase
    .from("applications")
    .select("program_id")
    .eq("user_id", userId)
    .not("program_id", "is", null);

  const programIds = [
    ...new Set((applications ?? []).map((a) => a.program_id).filter((id): id is string => Boolean(id))),
  ];
  if (programIds.length === 0) return [];

  const { data: programs } = await supabase.from("programs").select("university_id").in("id", programIds);
  const universityIds = [...new Set((programs ?? []).map((p) => p.university_id))];

  const cards = await buildUniversityCards(supabase, universityIds);
  return cards.sort((a, b) => b.postCount - a.postCount);
}

/** Real ranking by post count -- no synthetic floor, no fabricated counts.
 * Returns an empty list until real posts exist somewhere. */
export async function getPopularCommunities(
  supabase: Client,
  limit = 6,
): Promise<CommunityUniversityCard[]> {
  const { data: posts } = await supabase.from("community_posts").select("university_id").is("deleted_at", null);
  if (!posts || posts.length === 0) return [];

  const counts = new Map<string, number>();
  for (const post of posts) counts.set(post.university_id, (counts.get(post.university_id) ?? 0) + 1);

  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data: universities } = await supabase
    .from("universities")
    .select("id, official_name, country_code, city")
    .in("id", topIds);
  const universityById = new Map((universities ?? []).map((u) => [u.id, u]));

  return topIds
    .map((id) => {
      const u = universityById.get(id);
      if (!u) return null;
      return {
        id: u.id,
        name: u.official_name,
        countryCode: u.country_code,
        city: u.city,
        postCount: counts.get(id) ?? 0,
      };
    })
    .filter((card): card is CommunityUniversityCard => card !== null);
}

export async function searchCommunityUniversities(
  supabase: Client,
  query: string,
  limit = 10,
): Promise<CommunityUniversityCard[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data: universities } = await supabase
    .from("universities")
    .select("id, official_name, country_code, city")
    .ilike("official_name", `%${trimmed}%`)
    .order("official_name")
    .limit(limit);
  if (!universities || universities.length === 0) return [];

  const ids = universities.map((u) => u.id);
  const { data: posts } = await supabase
    .from("community_posts")
    .select("university_id")
    .in("university_id", ids)
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  for (const post of posts ?? []) counts.set(post.university_id, (counts.get(post.university_id) ?? 0) + 1);

  return universities.map((u) => ({
    id: u.id,
    name: u.official_name,
    countryCode: u.country_code,
    city: u.city,
    postCount: counts.get(u.id) ?? 0,
  }));
}

export interface CommunityRecentPost extends CommunityPostSummary {
  universityId: string;
  universityName: string;
}

/** Latest posts across every university's community, for the global
 * /[locale]/community landing page. */
export async function getRecentDiscussions(
  supabase: Client,
  limit = 10,
): Promise<CommunityRecentPost[]> {
  const { data: posts } = await supabase
    .from("community_posts")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!posts || posts.length === 0) return [];

  const universityIds = [...new Set(posts.map((p) => p.university_id))];
  const [{ data: universities }, authors, engagement, programLabels] = await Promise.all([
    supabase.from("universities").select("id, official_name").in("id", universityIds),
    fetchAuthors(supabase, posts.map((p) => p.user_id)),
    attachEngagement(supabase, posts, null),
    attachProgramLabels(supabase, posts),
  ]);
  const universityNameById = new Map((universities ?? []).map((u) => [u.id, u.official_name]));

  return posts.map((post) => {
    const eng = engagement.get(post.id) ?? { commentCount: 0, likeCount: 0, likedByViewer: false };
    const labels = programLabels.get(post.id) ?? { programName: null, intakeLabel: null };
    return {
      id: post.id,
      postType: post.post_type,
      title: post.title,
      body: post.body,
      createdAt: post.created_at,
      author: toAuthor(post.user_id, authors.get(post.user_id)),
      programName: labels.programName,
      intakeLabel: labels.intakeLabel,
      commentCount: eng.commentCount,
      likeCount: eng.likeCount,
      likedByViewer: eng.likedByViewer,
      universityId: post.university_id,
      universityName: universityNameById.get(post.university_id) ?? "",
    };
  });
}

export async function getCommunityProfile(
  supabase: Client,
  userId: string,
): Promise<CommunityProfileRow | null> {
  const { data } = await supabase
    .from("community_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
