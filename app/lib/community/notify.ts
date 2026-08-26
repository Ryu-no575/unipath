import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";

/**
 * Notifies the post owner (top-level comment) or the parent comment's owner
 * (a reply) that someone commented, via the *existing* `notifications`
 * table -- no parallel Community notification system, per AGENTS.md section
 * 10. Uses the service-role client because `notifications` has no
 * insert policy for anon/authenticated (see
 * supabase/migrations/20260826230000_watch_subscription_hardening.sql):
 * every notification is written server-side, same as the Live Data fan-out
 * in app/lib/live-data/notify.ts.
 */
export async function notifyOnCommunityComment(params: {
  postId: string;
  commentId: string;
  parentCommentId: string | null;
  commenterUserId: string;
  postTitleOrExcerpt: string;
}): Promise<void> {
  const supabase = createAdminClient();

  let recipientUserId: string | null = null;

  if (params.parentCommentId) {
    const { data: parent } = await supabase
      .from("community_comments")
      .select("user_id")
      .eq("id", params.parentCommentId)
      .maybeSingle();
    recipientUserId = parent?.user_id ?? null;
  } else {
    const { data: post } = await supabase
      .from("community_posts")
      .select("user_id")
      .eq("id", params.postId)
      .maybeSingle();
    recipientUserId = post?.user_id ?? null;
  }

  if (!recipientUserId || recipientUserId === params.commenterUserId) return;

  const title = params.parentCommentId ? "New reply" : "New comment";
  const message = `Someone ${params.parentCommentId ? "replied to your comment" : "commented on your post"}: "${params.postTitleOrExcerpt}"`;

  await supabase.from("notifications").insert({
    user_id: recipientUserId,
    community_post_id: params.postId,
    community_comment_id: params.commentId,
    title,
    message,
    read: false,
  });
}
