import { hasLocale } from "next-intl";
import { getFormatter, getNow, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getCommunityPost, listCommentsForPost } from "@/app/lib/data/community";
import Avatar from "@/app/components/community/Avatar";
import StudentStatusBadge from "@/app/components/community/StudentStatusBadge";
import LikeButton from "@/app/components/community/LikeButton";
import DeletePostButton from "@/app/components/community/DeletePostButton";
import ReportButton from "@/app/components/community/ReportButton";
import CommentForm from "@/app/components/community/CommentForm";
import CommentThread from "@/app/components/community/CommentThread";

export default async function CommunityPostDetailPage({
  params,
}: PageProps<"/[locale]/universities/[id]/community/[postId]">) {
  const { locale, id, postId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getOptionalUser();
  const supabase = await createClient();
  const post = await getCommunityPost(supabase, postId, user?.id ?? null);
  if (!post || post.universityId !== id) notFound();

  const comments = await listCommentsForPost(supabase, postId);

  const t = await getTranslations("Community");
  const postTypes = await getTranslations("PostTypeOptions");
  const format = await getFormatter();
  const now = await getNow();

  const isOwner = user?.id === post.author.userId;
  const subline = [post.programName, post.intakeLabel].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/universities/${id}/community`}
        className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        {t("back")}
      </Link>

      <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <Avatar name={post.author.displayName} seed={post.author.userId} />
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">{post.author.displayName}</span>
              <StudentStatusBadge status={post.author.studentStatus} verified={post.author.studentStatusVerified} />
            </div>
            <span className="text-xs text-zinc-400">
              {subline ? `${subline} · ` : ""}
              {format.relativeTime(new Date(post.createdAt), now)}
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            {postTypes(post.postType)}
          </span>
        </div>

        <div className="flex flex-col gap-2 pl-12">
          {post.title && <h1 className="text-lg font-semibold text-zinc-900">{post.title}</h1>}
          <p className="whitespace-pre-wrap text-sm text-zinc-700">{post.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-12 pt-2">
          <LikeButton
            locale={locale}
            universityId={id}
            postId={post.id}
            initialLiked={post.likedByViewer}
            initialCount={post.likeCount}
            canLike={Boolean(user)}
          />
          {isOwner && <DeletePostButton locale={locale} universityId={id} postId={post.id} />}
          {user && !isOwner && <ReportButton locale={locale} postId={post.id} />}
        </div>
      </article>

      <section className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {t("commentCount", { count: post.commentCount })}
        </h2>

        {user ? (
          <CommentForm locale={locale} universityId={id} postId={post.id} />
        ) : (
          <Link
            href="/login"
            className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            {t("loginToComment")}
          </Link>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noCommentsYet")}</p>
        ) : (
          <CommentThread
            locale={locale}
            universityId={id}
            postId={post.id}
            comments={comments}
            viewerUserId={user?.id ?? null}
          />
        )}
      </section>
    </div>
  );
}
