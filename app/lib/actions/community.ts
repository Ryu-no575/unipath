"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import type { CommunityPostType, StudentStatus } from "@/app/lib/supabase/database.types";
import { notifyOnCommunityComment } from "@/app/lib/community/notify";
import { recordAnalyticsEvent } from "@/app/lib/analytics/track";

export interface CommunityActionResult {
  error?: string;
}

function toNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface CreateCommunityPostInput {
  universityId: string;
  programId: string;
  postType: CommunityPostType;
  title: string;
  body: string;
}

export async function createCommunityPostAction(
  locale: AppLocale,
  input: CreateCommunityPostInput,
): Promise<CommunityActionResult> {
  const body = input.body.trim();
  if (!body) return { error: "A post needs a body." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      user_id: user.id,
      university_id: input.universityId,
      program_id: toNull(input.programId),
      post_type: input.postType,
      title: toNull(input.title),
      body,
      language_code: locale,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await recordAnalyticsEvent(supabase, user.id, "community_posted", { postType: input.postType });

  revalidatePath(`/${locale}/universities/${input.universityId}/community`);
  redirect(`/${locale}/universities/${input.universityId}/community/${data.id}`);
}

export async function deleteCommunityPostAction(
  locale: AppLocale,
  universityId: string,
  postId: string,
): Promise<CommunityActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("community_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/universities/${universityId}/community`);
  redirect(`/${locale}/universities/${universityId}/community`);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function createCommunityCommentAction(
  locale: AppLocale,
  universityId: string,
  postId: string,
  parentCommentId: string | null,
  body: string,
): Promise<CommunityActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "A comment can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: comment, error }, { data: post }] = await Promise.all([
    supabase
      .from("community_comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        parent_comment_id: parentCommentId,
        body: trimmed,
      })
      .select("id")
      .single(),
    supabase.from("community_posts").select("title, body").eq("id", postId).maybeSingle(),
  ]);
  if (error) return { error: error.message };

  await notifyOnCommunityComment({
    postId,
    commentId: comment.id,
    parentCommentId,
    commenterUserId: user.id,
    postTitleOrExcerpt: (post?.title || post?.body || "").slice(0, 80),
  });

  revalidatePath(`/${locale}/universities/${universityId}/community/${postId}`);
  return {};
}

export async function deleteCommunityCommentAction(
  locale: AppLocale,
  universityId: string,
  postId: string,
  commentId: string,
): Promise<CommunityActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("community_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/universities/${universityId}/community/${postId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

export async function toggleCommunityPostLikeAction(
  locale: AppLocale,
  universityId: string,
  postId: string,
): Promise<CommunityActionResult & { liked?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath(`/${locale}/universities/${universityId}/community/${postId}`);
    revalidatePath(`/${locale}/universities/${universityId}/community`);
    return { liked: false };
  }

  const { error } = await supabase.from("community_post_likes").insert({
    post_id: postId,
    user_id: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/${locale}/universities/${universityId}/community/${postId}`);
  revalidatePath(`/${locale}/universities/${universityId}/community`);
  return { liked: true };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function reportCommunityContentAction(
  locale: AppLocale,
  target: { postId: string | null; commentId: string | null },
  reason: string,
  details: string,
): Promise<CommunityActionResult> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "A reason is required." };
  if (!target.postId && !target.commentId) return { error: "Nothing to report." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("community_reports").insert({
    reporter_user_id: user.id,
    post_id: target.postId,
    comment_id: target.commentId,
    reason: trimmedReason,
    details: toNull(details),
  });
  if (error) return { error: error.message };

  void locale;
  return {};
}

// ---------------------------------------------------------------------------
// Community identity (display name + self-reported status)
// ---------------------------------------------------------------------------

export interface CommunityProfileInput {
  displayName: string;
  studentStatus: StudentStatus | "";
}

export async function updateCommunityProfileAction(
  locale: AppLocale,
  values: CommunityProfileInput,
): Promise<CommunityActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Never touches student_status_verified -- that flag is set exclusively by
  // an out-of-band verification process, never by the user's own edit.
  const { error } = await supabase.from("community_profiles").upsert(
    {
      user_id: user.id,
      display_name: toNull(values.displayName),
      student_status: values.studentStatus || null,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/profile`);
  return {};
}
