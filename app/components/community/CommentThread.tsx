"use client";

import { useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { CommunityComment } from "@/app/lib/data/community";
import Avatar from "./Avatar";
import CommentForm from "./CommentForm";
import DeleteCommentButton from "./DeleteCommentButton";
import ReportButton from "./ReportButton";

// Client component (not the async-server pattern the other Community
// pieces use) because each comment needs its own independent "reply form
// open/closed" toggle state.
function StatusInline({ status, verified }: { status: string | null; verified: boolean }) {
  const t = useTranslations("StudentStatusOptions");
  const common = useTranslations("Community");
  if (!status) return null;
  const key =
    status === "current_student" ? "currentStudent" : status === "applicant" ? "applicant" : status === "admitted" ? "admitted" : "alumni";
  return (
    <span className="text-xs text-zinc-500">
      {t(key)} {verified ? `· ${common("verified")}` : `· ${common("unverified")}`}
    </span>
  );
}

function SingleComment({
  locale,
  universityId,
  postId,
  comment,
  viewerUserId,
  allowReply,
}: {
  locale: AppLocale;
  universityId: string;
  postId: string;
  comment: CommunityComment;
  viewerUserId: string | null;
  allowReply: boolean;
}) {
  const t = useTranslations("Community");
  const format = useFormatter();
  const now = useNow();
  const [replying, setReplying] = useState(false);
  const isOwner = viewerUserId === comment.author.userId;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Avatar name={comment.author.displayName} seed={comment.author.userId} />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-900">{comment.author.displayName}</span>
            <StatusInline status={comment.author.studentStatus} verified={comment.author.studentStatusVerified} />
            <span className="text-xs text-zinc-400">{format.relativeTime(new Date(comment.createdAt), now)}</span>
          </div>
          <p className="text-sm text-zinc-700">{comment.body}</p>
          <div className="flex items-center gap-3">
            {allowReply && viewerUserId && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                {t("reply")}
              </button>
            )}
            {isOwner && (
              <DeleteCommentButton locale={locale} universityId={universityId} postId={postId} commentId={comment.id} />
            )}
            {viewerUserId && !isOwner && <ReportButton locale={locale} commentId={comment.id} />}
          </div>
          {replying && (
            <div className="pt-1">
              <CommentForm
                locale={locale}
                universityId={universityId}
                postId={postId}
                parentCommentId={comment.id}
                autoFocus
                onPosted={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies.length > 0 && (
        <div className="ml-12 flex flex-col gap-3 border-l border-zinc-100 pl-4">
          {comment.replies.map((reply) => (
            <SingleComment
              key={reply.id}
              locale={locale}
              universityId={universityId}
              postId={postId}
              comment={reply}
              viewerUserId={viewerUserId}
              allowReply={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({
  locale,
  universityId,
  postId,
  comments,
  viewerUserId,
}: {
  locale: AppLocale;
  universityId: string;
  postId: string;
  comments: CommunityComment[];
  viewerUserId: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {comments.map((comment) => (
        <SingleComment
          key={comment.id}
          locale={locale}
          universityId={universityId}
          postId={postId}
          comment={comment}
          viewerUserId={viewerUserId}
          allowReply
        />
      ))}
    </div>
  );
}
