import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import {
  COMMUNITY_POST_TYPES,
  getCommunityMemberCounts,
  getUniversityForCommunity,
  listCommunityPosts,
} from "@/app/lib/data/community";
import type { CommunityPostType } from "@/app/lib/supabase/database.types";
import UniversityTabs from "@/app/components/universities/UniversityTabs";
import MemberStats from "@/app/components/community/MemberStats";
import CommunityFilterTabs from "@/app/components/community/CommunityFilterTabs";
import PostCard from "@/app/components/community/PostCard";
import CommunityEmptyState from "@/app/components/community/CommunityEmptyState";
import PageHeader from "@/app/components/ui/PageHeader";
import Button from "@/app/components/ui/Button";

function parsePostType(value: string | string[] | undefined): CommunityPostType | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && (COMMUNITY_POST_TYPES as string[]).includes(raw) ? (raw as CommunityPostType) : undefined;
}

export default async function UniversityCommunityPage({
  params,
  searchParams,
}: PageProps<"/[locale]/universities/[id]/community">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;
  const postType = parsePostType(resolvedSearchParams.type);

  const supabase = await createClient();
  const [user, university] = await Promise.all([getOptionalUser(), getUniversityForCommunity(supabase, id)]);
  if (!university) notFound();

  const [memberCounts, posts] = await Promise.all([
    getCommunityMemberCounts(supabase, id),
    listCommunityPosts(supabase, id, { postType }, user?.id ?? null),
  ]);

  const t = await getTranslations("Community");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("universityCommunityHeading", { university: university.name })}
        description={t("subheading")}
      />

      <UniversityTabs universityId={id} active="community" />

      <MemberStats counts={memberCounts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CommunityFilterTabs universityId={id} active={postType ?? "all"} />
        {user ? (
          <Button href={`/universities/${id}/community/new`} className="shrink-0">
            {t("newPost")}
          </Button>
        ) : (
          <Button href="/login" variant="secondary" className="shrink-0">
            {t("loginToPost")}
          </Button>
        )}
      </div>

      {posts.length === 0 ? (
        <CommunityEmptyState universityId={id} />
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} universityId={id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
