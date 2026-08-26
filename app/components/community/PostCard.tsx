import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CommunityPostSummary } from "@/app/lib/data/community";
import Avatar from "./Avatar";
import StudentStatusBadge from "./StudentStatusBadge";

export default async function PostCard({
  universityId,
  post,
}: {
  universityId: string;
  post: CommunityPostSummary;
}) {
  const t = await getTranslations("Community");
  const postTypes = await getTranslations("PostTypeOptions");
  const format = await getFormatter();
  const now = await getNow();

  const excerpt = post.body.length > 220 ? `${post.body.slice(0, 220)}…` : post.body;
  const subline = [post.programName, post.intakeLabel].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/universities/${universityId}/community/${post.id}`}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
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

      <div className="flex flex-col gap-1 pl-12">
        {post.title && <h3 className="text-sm font-semibold text-zinc-900">{post.title}</h3>}
        <p className="text-sm text-zinc-600">{excerpt}</p>
      </div>

      <div className="flex items-center gap-4 pl-12 text-xs text-zinc-400">
        <span>{t("commentCount", { count: post.commentCount })}</span>
        <span>{t("likeCount", { count: post.likeCount })}</span>
      </div>
    </Link>
  );
}
